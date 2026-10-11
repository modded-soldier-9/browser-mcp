mod bridge;
mod protocol;
mod sandbox;
mod tools;
mod watchdog;

use std::io::{self, BufRead, Write};
use std::path::PathBuf;
use std::sync::Arc;

use clap::Parser;
use serde_json::{json, Value};
use tokio::sync::broadcast;

use bridge::Bridge;
use protocol::{CallToolResult, JsonRpcError, JsonRpcRequest, JsonRpcResponse, TextContent, ToolContent, ImageContent};
use tools::{get_tools_list, normalize_tool_name, METHOD_MAP};

#[derive(Parser, Debug)]
#[command(name = "browser-mcp", version = "2.0.0", about = "Native JeikCode Browser MCP Server in Rust")]
struct Cli {
    #[arg(short = 'v', long = "version")]
    version_flag: bool,

    #[arg(long = "serve")]
    serve: bool,

    #[arg(long = "install")]
    install: bool,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    if cli.version_flag {
        println!("2.0.0");
        return Ok(());
    }

    if cli.install {
        println!("Browser MCP v2.0.0 (Rust Edition)");
        println!("Registering with JeikCode...");
        return Ok(());
    }

    let bridge = Arc::new(Bridge::new());
    let strip_prefix = std::env::var("BROWSER_MCP_STRIP_TOOL_PREFIX").map(|v| v == "1").unwrap_or(false);

    if cli.serve {
        eprintln!("[Browser MCP] Running persistent bridge server on ws://127.0.0.1:9876...");
        let _ = bridge.ensure_port().await;
        // Keep alive indefinitely in serve mode
        tokio::signal::ctrl_c().await?;
        return Ok(());
    }

    // Default: Stdio MCP Server
    eprintln!("[MCP] Browser MCP server running (Rust / stdio)");

    // Parent process watchdog
    let (shutdown_tx, _) = broadcast::channel::<()>(1);
    let parent_pid = std::process::id(); // or sysinfo ppid
    watchdog::spawn_watchdog(parent_pid, shutdown_tx.clone());

    // Auto-warm port
    let bridge_warm = bridge.clone();
    tokio::spawn(async move {
        let _ = bridge_warm.ensure_port().await;
    });

    // Run stdio line reader
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    let mut lines = stdin.lock().lines();

    while let Some(Ok(line)) = lines.next() {
        if line.trim().is_empty() {
            continue;
        }

        let req: JsonRpcRequest = match serde_json::from_str(&line) {
            Ok(r) => r,
            Err(_) => continue,
        };

        let bridge = bridge.clone();
        let res = handle_request(req, bridge, strip_prefix).await;

        if let Some(resp) = res {
            let serialized = serde_json::to_string(&resp)?;
            writeln!(stdout, "{}", serialized)?;
            stdout.flush()?;
        }
    }

    Ok(())
}

async fn handle_request(
    req: JsonRpcRequest,
    bridge: Arc<Bridge>,
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
                        "version": "2.0.0"
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

            let timeout_ms = match method {
                "ask_user" => 125000,
                "solve_captcha" => 60000,
                "extract_list" => 180000,
                _ => 30000,
            };

            match bridge.send_command(method, args, timeout_ms).await {
                Ok(val) => {
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
