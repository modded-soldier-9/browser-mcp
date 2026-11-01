mod bridge;
mod delta;
mod installer;
mod protocol;
mod sandbox;
mod shield;
mod tools;
mod watchdog;

use std::path::PathBuf;
use std::sync::Arc;

use clap::{Parser, Subcommand};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{broadcast, mpsc, Mutex};

use bridge::Bridge;
use delta::DeltaEngine;
use protocol::{CallToolResult, ImageContent, JsonRpcError, JsonRpcRequest, JsonRpcResponse, TextContent, ToolContent};
use shield::ContextShield;
use tools::{get_tools_list, normalize_tool_name, METHOD_MAP};

#[derive(Parser, Debug)]
#[command(name = "browser-mcp", version = env!("CARGO_PKG_VERSION"), about = "Native Browser MCP Server driving Brave and Chrome")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    #[arg(long = "serve")]
    serve: bool,

    #[arg(long = "install")]
    install_flag: bool,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Install embedded extension and display client assistant configurations
    Install,
    /// Run bridge WebSocket server in background serve mode
    Serve,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    if cli.install_flag || matches!(cli.command, Some(Commands::Install)) {
        return installer::run_install();
    }

    let bridge = Arc::new(Bridge::new());
    let shield = Arc::new(ContextShield::new());
    let delta = Arc::new(Mutex::new(DeltaEngine::new()));
    let strip_prefix = std::env::var("BROWSER_MCP_STRIP_TOOL_PREFIX").map(|v| v == "1").unwrap_or(false);

    if cli.serve || matches!(cli.command, Some(Commands::Serve)) {
        eprintln!("[Browser MCP] Running persistent bridge server on ws://127.0.0.1:9876...");
        let _ = bridge.ensure_port().await;
        tokio::signal::ctrl_c().await?;
        return Ok(());
    }

    // Default: Stdio MCP Server
    eprintln!("[MCP] Browser MCP server running (Rust / stdio v{})", env!("CARGO_PKG_VERSION"));

    let (shutdown_tx, mut shutdown_rx) = broadcast::channel::<()>(1);
    watchdog::spawn_signal_watchdog(shutdown_tx.clone());

    // Auto-warm port
    let bridge_warm = bridge.clone();
    tokio::spawn(async move {
        let _ = bridge_warm.ensure_port().await;
    });

    // Decoupled Stdout Writer Task
    let (stdout_tx, mut stdout_rx) = mpsc::unbounded_channel::<String>();
    let stdout_writer = tokio::spawn(async move {
        let mut stdout = tokio::io::stdout();
        while let Some(line) = stdout_rx.recv().await {
            if stdout.write_all(line.as_bytes()).await.is_err() {
                break;
            }
            if stdout.write_all(b"\n").await.is_err() {
                break;
            }
            if stdout.flush().await.is_err() {
                break;
            }
        }
    });

    // Sequential queue for browser mutation actions
    let (cmd_tx, mut cmd_rx) = mpsc::unbounded_channel::<(JsonRpcRequest, mpsc::UnboundedSender<String>)>();
    let bridge_worker = bridge.clone();
    let shield_worker = shield.clone();
    let delta_worker = delta.clone();
    let worker_task = tokio::spawn(async move {
        while let Some((req, out_tx)) = cmd_rx.recv().await {
            let bridge = bridge_worker.clone();
            let shield = shield_worker.clone();
            let delta = delta_worker.clone();
            let res = handle_request(req, bridge, shield, delta, strip_prefix).await;
            if let Some(resp) = res {
                if let Ok(serialized) = serde_json::to_string(&resp) {
                    let _ = out_tx.send(serialized);
                }
            }
        }
    });

    // Asynchronous Stdin Reader Task
    let mut stdin_reader = BufReader::new(tokio::io::stdin());
    let mut line_buf = String::new();

    loop {
        line_buf.clear();
        tokio::select! {
            _ = shutdown_rx.recv() => {
                eprintln!("[MCP] Shutdown signal received, terminating server cleanly");
                break;
            }
            read_res = stdin_reader.read_line(&mut line_buf) => {
                match read_res {
                    Ok(0) => {
                        // Stdin EOF: Client process exited or closed the pipe
                        eprintln!("[MCP] Host stdin pipe closed (EOF), shutting down");
                        let _ = shutdown_tx.send(());
                        break;
                    }
                    Ok(_) => {
                        let trimmed = line_buf.trim();
                        if trimmed.is_empty() {
                            continue;
                        }

                        let req: JsonRpcRequest = match serde_json::from_str(trimmed) {
                            Ok(r) => r,
                            Err(_) => continue,
                        };

                        // Fast-path for MCP Ping: response must not queue behind long-running browser tools
                        if req.method == "ping" {
                            if let Some(ref id) = req.id {
                                let ping_resp = json!({
                                    "jsonrpc": "2.0",
                                    "id": id,
                                    "result": {}
                                });
                                let _ = stdout_tx.send(ping_resp.to_string());
                            }
                            continue;
                        }

                        // Notifications require no response
                        if req.method == "notifications/initialized" {
                            continue;
                        }

                        // Fast path for initialize and tools/list
                        if req.method == "initialize" || req.method == "tools/list" {
                            let bridge = bridge.clone();
                            let shield = shield.clone();
                            let delta = delta.clone();
                            let res = handle_request(req, bridge, shield, delta, strip_prefix).await;
                            if let Some(resp) = res {
                                if let Ok(serialized) = serde_json::to_string(&resp) {
                                    let _ = stdout_tx.send(serialized);
                                }
                            }
                            continue;
                        }

                        // Route tool calls to sequential command queue
                        let _ = cmd_tx.send((req, stdout_tx.clone()));
                    }
                    Err(e) => {
                        eprintln!("[MCP] Error reading stdin: {}", e);
                        break;
                    }
                }
            }
        }
    }

    worker_task.abort();
    stdout_writer.abort();
    Ok(())
}

async fn handle_request(
    req: JsonRpcRequest,
    bridge: Arc<Bridge>,
    shield: Arc<ContextShield>,
    delta: Arc<Mutex<DeltaEngine>>,
    strip_prefix: bool,
) -> Option<JsonRpcResponse> {
    let id = req.id.clone()?;

    match req.method.as_str() {
        "initialize" => {
            let instructions = "You control the user's real Chrome/Brave browser via this native Rust MCP server. Each session gets its own color-coded tab group.";
            Some(JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id,
                result: Some(json!({
                    "protocolVersion": "2024-11-05",
                    "capabilities": { "tools": {} },
                    "serverInfo": {
                        "name": "browser-mcp",
                        "version": env!("CARGO_PKG_VERSION")
                    },
                    "instructions": instructions
                })),
                error: None,
            })
        }
        "notifications/initialized" => None,
        "tools/list" => {
            let tools = get_tools_list(strip_prefix);
            Some(JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id,
                result: Some(json!({ "tools": tools })),
                error: None,
            })
        }
        "tools/call" => {
            let params = req.params.unwrap_or(Value::Null);
            let name_raw = params.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let name = normalize_tool_name(name_raw);
            let mut args = params.get("arguments").cloned().unwrap_or(json!({}));

            let method = match METHOD_MAP.get(name.as_str()) {
                Some(&m) => m,
                None => {
                    return Some(JsonRpcResponse {
                        jsonrpc: "2.0".to_string(),
                        id,
                        result: Some(serde_json::to_value(CallToolResult {
                            content: vec![ToolContent::Text(TextContent {
                                content_type: "text".to_string(),
                                text: format!("Unknown tool: {}", name_raw),
                            })],
                            is_error: Some(true),
                        }).unwrap()),
                        error: None,
                    });
                }
            };

            // Local Server Tools (browser_about, browser_provide_feedback)
            if tools::is_local_tool(method) {
                let (active_port, connected_count, profiles) = bridge.get_status().await;
                match tools::handle_local_tool(method, &args, active_port, connected_count, profiles).await {
                    Ok(val) => {
                        return Some(JsonRpcResponse {
                            jsonrpc: "2.0".to_string(),
                            id,
                            result: Some(serde_json::to_value(CallToolResult {
                                content: vec![ToolContent::Text(TextContent {
                                    content_type: "text".to_string(),
                                    text: serde_json::to_string_pretty(&val).unwrap_or_else(|_| val.to_string()),
                                })],
                                is_error: None,
                            }).unwrap()),
                            error: None,
                        });
                    }
                    Err(err_msg) => {
                        return Some(JsonRpcResponse {
                            jsonrpc: "2.0".to_string(),
                            id,
                            result: Some(serde_json::to_value(CallToolResult {
                                content: vec![ToolContent::Text(TextContent {
                                    content_type: "text".to_string(),
                                    text: format!("Error: {}", err_msg),
                                })],
                                is_error: Some(true),
                            }).unwrap()),
                            error: None,
                        });
                    }
                }
            }

            // Path sandboxing for screenshot and uploads
            let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
            let mut save_path: Option<PathBuf> = None;
            if method == "screenshot" {
                if let Some(path_str) = args.get("path").and_then(|v| v.as_str()) {
                    match sandbox::resolve_screenshot_path(path_str, &cwd) {
                        Ok(target) => {
                            save_path = Some(target);
                        }
                        Err(err_msg) => {
                            return Some(JsonRpcResponse {
                                jsonrpc: "2.0".to_string(),
                                id,
                                result: Some(serde_json::to_value(CallToolResult {
                                    content: vec![ToolContent::Text(TextContent {
                                        content_type: "text".to_string(),
                                        text: err_msg,
                                    })],
                                    is_error: Some(true),
                                }).unwrap()),
                                error: None,
                            });
                        }
                    }
                }
            } else if method == "upload_file" || method == "drop_file" {
                let mut files_to_check = Vec::new();
                if let Some(files_arr) = args.get("files").and_then(|v| v.as_array()) {
                    for f in files_arr {
                        if let Some(s) = f.as_str() {
                            files_to_check.push(s.to_string());
                        }
                    }
                } else if let Some(single_f) = args.get("file").or_else(|| args.get("file_path")).and_then(|v| v.as_str()) {
                    files_to_check.push(single_f.to_string());
                }

                if !files_to_check.is_empty() {
                    match sandbox::sanitize_upload_files(&files_to_check, &cwd) {
                        Ok(sanitized) => {
                            args["files"] = json!(sanitized);
                        }
                        Err(err_msg) => {
                            return Some(JsonRpcResponse {
                                jsonrpc: "2.0".to_string(),
                                id,
                                result: Some(serde_json::to_value(CallToolResult {
                                    content: vec![ToolContent::Text(TextContent {
                                        content_type: "text".to_string(),
                                        text: err_msg,
                                    })],
                                    is_error: Some(true),
                                }).unwrap()),
                                error: None,
                            });
                        }
                    }
                }
            }

            let requested_format = if method == "get_page_content" {
                args.get("format").and_then(|v| v.as_str()).unwrap_or("text").to_string()
            } else {
                String::new()
            };
            let max_tokens = if method == "get_page_content" {
                args.get("max_tokens").and_then(|v| v.as_u64()).map(|v| v as usize)
            } else {
                None
            };
            let page_offset = if method == "get_page_content" {
                args.get("page_offset").and_then(|v| v.as_u64()).unwrap_or(0) as usize
            } else {
                0
            };
            let limit = if method == "get_page_content" {
                args.get("limit").and_then(|v| v.as_u64()).unwrap_or(100) as usize
            } else {
                100
            };

            let timeout_ms = match method {
                "ask_user" => 125000,
                "solve_captcha" => 60000,
                "extract_list" => 180000,
                _ => 30000,
            };

            match bridge.send_command(method, args, timeout_ms).await {
                Ok(mut val) => {
                    if method == "navigate" {
                        let tab_id = val.get("tab_id").and_then(|v| v.as_u64()).unwrap_or(0);
                        if tab_id != 0 {
                            delta.lock().await.reset_tab(tab_id);
                        }
                    } else if method == "get_page_content" {
                        let tab_id = val.get("tab_id").and_then(|v| v.as_u64()).unwrap_or(0);
                        let content_text = val.get("content").and_then(|v| v.as_str()).unwrap_or("");

                        if requested_format == "delta" {
                            let mut delta_res = delta.lock().await.process_snapshot(tab_id, content_text);
                            if let Some(obj) = delta_res.as_object_mut() {
                                if let Some(t) = val.get("title") { obj.insert("title".to_string(), t.clone()); }
                                if let Some(u) = val.get("url") { obj.insert("url".to_string(), u.clone()); }
                                obj.insert("tab_id".to_string(), json!(tab_id));
                            }
                            val = delta_res;
                        } else if let Some(mut shielded_val) = shield.protect(tab_id, content_text, max_tokens, page_offset, limit) {
                            if let Some(obj) = shielded_val.as_object_mut() {
                                if let Some(t) = val.get("title") { obj.insert("title".to_string(), t.clone()); }
                                if let Some(u) = val.get("url") { obj.insert("url".to_string(), u.clone()); }
                                obj.insert("tab_id".to_string(), json!(tab_id));
                            }
                            val = shielded_val;
                        }
                    }

                    if method == "screenshot" {
                        if let Some(img_str) = val.get("image").and_then(|v| v.as_str()) {
                            let (data, mime) = if img_str.starts_with("data:image/jpeg") {
                                (img_str.trim_start_matches("data:image/jpeg;base64,"), "image/jpeg")
                            } else {
                                (img_str.trim_start_matches("data:image/png;base64,"), "image/png")
                            };

                            let mut contents = Vec::new();
                            if let Some(target) = save_path {
                                if let Some(parent) = target.parent() {
                                    let _ = std::fs::create_dir_all(parent);
                                }
                                if let Some(bytes) = protocol::decode_base64(data) {
                                    if std::fs::write(&target, bytes).is_ok() {
                                        contents.push(ToolContent::Text(TextContent {
                                            content_type: "text".to_string(),
                                            text: format!("Screenshot successfully saved to: {}", target.display()),
                                        }));
                                    }
                                }
                            }

                            contents.push(ToolContent::Image(ImageContent {
                                content_type: "image".to_string(),
                                data: data.to_string(),
                                mime_type: mime.to_string(),
                            }));

                            return Some(JsonRpcResponse {
                                jsonrpc: "2.0".to_string(),
                                id,
                                result: Some(serde_json::to_value(CallToolResult {
                                    content: contents,
                                    is_error: None,
                                }).unwrap()),
                                error: None,
                            });
                        }
                    }

                    Some(JsonRpcResponse {
                        jsonrpc: "2.0".to_string(),
                        id,
                        result: Some(serde_json::to_value(CallToolResult {
                            content: vec![ToolContent::Text(TextContent {
                                content_type: "text".to_string(),
                                text: serde_json::to_string_pretty(&val).unwrap_or_else(|_| val.to_string()),
                            })],
                            is_error: None,
                        }).unwrap()),
                        error: None,
                    })
                }
                Err(err_msg) => Some(JsonRpcResponse {
                    jsonrpc: "2.0".to_string(),
                    id,
                    result: Some(serde_json::to_value(CallToolResult {
                        content: vec![ToolContent::Text(TextContent {
                            content_type: "text".to_string(),
                            text: format!("Error: {}", err_msg),
                        })],
                        is_error: Some(true),
                    }).unwrap()),
                    error: None,
                }),
            }
        }
        _ => Some(JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id,
            result: None,
            error: Some(JsonRpcError {
                code: -32601,
                message: format!("Method not found: {}", req.method),
                data: None,
            }),
        }),
    }
}
