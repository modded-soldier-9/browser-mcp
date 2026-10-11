use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use regex::Regex;
use serde_json::{json, Value};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, oneshot, RwLock};
use tokio_tungstenite::tungstenite::handshake::server::{Request, Response};
use tokio_tungstenite::tungstenite::protocol::Message;
use tokio_tungstenite::accept_hdr_async;

pub const DEFAULT_BASE_PORT: u16 = 9876;
pub const DEFAULT_MAX_PORT: u16 = 9895;

#[derive(Clone)]
pub struct ExtensionConnection {
    pub seq: u64,
    pub extension_id: String,
    pub version: Option<String>,
    pub name: Option<String>,
    pub tx: mpsc::UnboundedSender<String>,
}

pub struct BridgeState {
    pub active_port: Option<u16>,
    pub connections: Vec<ExtensionConnection>,
    pub pending: HashMap<u64, oneshot::Sender<Result<Value, String>>>,
    pub seq_counter: u64,
}

#[derive(Clone)]
pub struct Bridge {
    state: Arc<RwLock<BridgeState>>,
    cmd_id: Arc<AtomicU64>,
    base_port: u16,
    max_port: u16,
}

impl Bridge {
    pub fn new() -> Self {
        let base_port = std::env::var("BROWSER_MCP_BASE_PORT")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(DEFAULT_BASE_PORT);
        let max_port = std::env::var("BROWSER_MCP_MAX_PORT")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(DEFAULT_MAX_PORT);

        Self {
            state: Arc::new(RwLock::new(BridgeState {
                active_port: None,
                connections: Vec::new(),
                pending: HashMap::new(),
                seq_counter: 0,
            })),
            cmd_id: Arc::new(AtomicU64::new(1)),
            base_port,
            max_port,
        }
    }

    pub async fn ensure_port(&self) -> Result<u16, String> {
        {
            let state = self.state.read().await;
            if let Some(port) = state.active_port {
                return Ok(port);
            }
        }

        for port in self.base_port..=self.max_port {
            let addr: SocketAddr = format!("127.0.0.1:{}", port).parse().unwrap();
            match TcpListener::bind(addr).await {
                Ok(listener) => {
                    {
                        let mut state = self.state.write().await;
                        state.active_port = Some(port);
                    }
                    eprintln!("[MCP] WebSocket server listening on ws://127.0.0.1:{}", port);
                    let bridge = self.clone();
                    tokio::spawn(async move {
                        bridge.run_listener(listener, port).await;
                    });
                    return Ok(port);
                }
                Err(_) => {
                    if port < self.max_port {
                        eprintln!("[MCP] Port {} in use, trying {}...", port, port + 1);
                    }
                }
            }
        }

        Err(format!(
            "All ports {}-{} are taken right now. Please close another browser session.",
            self.base_port, self.max_port
        ))
    }

    async fn run_listener(&self, listener: TcpListener, port: u16) {
        let origin_regex = Regex::new(r"^chrome-extension://[a-p]{32}$").unwrap();

        while let Ok((mut stream, _)) = listener.accept().await {
            let origin_re = origin_regex.clone();
            let bridge = self.clone();

            tokio::spawn(async move {
                // Inspect incoming HTTP request for probe (fetch) vs real WebSocket
                let mut peek_buf = [0u8; 1024];
                let n = match stream.peek(&mut peek_buf).await {
                    Ok(n) => n,
                    Err(_) => return,
                };
                let head_str = String::from_utf8_lossy(&peek_buf[..n]);

                // Extension probe check: extension probes with plain HTTP GET to test for 426
                if head_str.starts_with("GET ")
                    && !head_str.contains("Sec-WebSocket-Key")
                    && !head_str.to_lowercase().contains("upgrade: websocket")
                {
                    use tokio::io::{AsyncReadExt, AsyncWriteExt};
                    let mut discard_buf = vec![0u8; n];
                    let _ = stream.read(&mut discard_buf).await;
                    let resp = b"HTTP/1.1 426 Upgrade Required\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nContent-Length: 0\r\n\r\n";
                    let _ = stream.write_all(resp).await;
                    let _ = stream.flush().await;
                    return;
                }

                let callback = |req: &Request, response: Response| {
                    if let Some(origin) = req.headers().get("Origin") {
                        if let Ok(o_str) = origin.to_str() {
                            if origin_re.is_match(o_str) {
                                return Ok(response);
                            }
                        }
                    }
                    Err(Response::builder()
                        .status(401)
                        .body(Some("only chrome extensions may connect".to_string()))
                        .unwrap())
                };

                match accept_hdr_async(stream, callback).await {
                    Ok(ws_stream) => {
                        bridge.handle_ws_connection(ws_stream, port).await;
                    }
                    Err(e) => {
                        eprintln!("[MCP] WebSocket handshake failed: {}", e);
                    }
                }
            });
        }
    }

    async fn handle_ws_connection(&self, ws_stream: tokio_tungstenite::WebSocketStream<TcpStream>, port: u16) {
        let (mut ws_sender, mut ws_receiver) = ws_stream.split();
        let (out_tx, mut out_rx) = mpsc::unbounded_channel::<String>();

        let seq = {
            let mut state = self.state.write().await;
            state.seq_counter += 1;
            let seq = state.seq_counter;
            let conn = ExtensionConnection {
                seq,
                extension_id: "unknown".to_string(),
                version: None,
                name: None,
                tx: out_tx.clone(),
            };
            state.connections.push(conn);
            seq
        };

        eprintln!("[MCP] Chrome extension connected on port {}", port);

        // Task to write outgoing frames to WebSocket
        let write_task = tokio::spawn(async move {
            while let Some(msg) = out_rx.recv().await {
                if ws_sender.send(Message::Text(msg.into())).await.is_err() {
                    break;
                }
            }
        });

        // Loop reading incoming frames from WebSocket
        while let Some(Ok(msg)) = ws_receiver.next().await {
            if let Message::Text(text) = msg {
                let parsed: Value = match serde_json::from_str(&text) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                if let Some(msg_type) = parsed.get("type").and_then(|v| v.as_str()) {
                    if msg_type == "ping" {
                        let _ = out_tx.send(json!({ "type": "pong" }).to_string());
                        continue;
                    }
                    if msg_type == "hello" {
                        let mut state = self.state.write().await;
                        if let Some(c) = state.connections.iter_mut().find(|c| c.seq == seq) {
                            if let Some(ext_id) = parsed.get("extensionId").and_then(|v| v.as_str()) {
                                c.extension_id = ext_id.to_string();
                            }
                            c.version = parsed.get("version").and_then(|v| v.as_str()).map(|s| s.to_string());
                            c.name = parsed.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
                        }
                        continue;
                    }
                }

                if let Some(id) = parsed.get("id").and_then(|v| v.as_u64()) {
                    let mut state = self.state.write().await;
                    if let Some(sender) = state.pending.remove(&id) {
                        if let Some(err_val) = parsed.get("error") {
                            let err_str = err_val.as_str().unwrap_or("Unknown error").to_string();
                            let _ = sender.send(Err(err_str));
                        } else if let Some(res_val) = parsed.get("result") {
                            let _ = sender.send(Ok(res_val.clone()));
                        }
                    }
                }
            }
        }

        // Clean up on disconnect
        write_task.abort();
        let mut state = self.state.write().await;
        state.connections.retain(|c| c.seq != seq);
        eprintln!("[MCP] Chrome extension disconnected ({} remaining)", state.connections.len());
    }

    pub async fn send_command(&self, method: &str, params: Value, timeout_ms: u64) -> Result<Value, String> {
        self.ensure_port().await?;

        // Wait up to 5 seconds for extension to be connected
        let start = std::time::Instant::now();
        loop {
            {
                let state = self.state.read().await;
                if !state.connections.is_empty() {
                    break;
                }
            }
            if start.elapsed() > Duration::from_millis(5000) {
                return Err("Chrome extension not connected after 5 seconds. Check Brave is open and Browser MCP extension is loaded.".to_string());
            }
            tokio::time::sleep(Duration::from_millis(200)).await;
        }

        let (tx, rx) = oneshot::channel();
        let id = self.cmd_id.fetch_add(1, Ordering::SeqCst);

        let parent_pid = std::process::id(); // current process or ppid
        let jeikcode_session = std::env::var("JEIKCODE_SESSION_ID")
            .or_else(|_| std::env::var("ATOMCODE_SESSION_ID"))
            .unwrap_or_else(|_| "JeikCode".to_string());
        let agent = std::env::var("BROWSER_MCP_AGENT").unwrap_or_else(|_| "JeikCode".to_string());

        let cmd_payload = json!({
            "id": id,
            "method": method,
            "params": params,
            "pid": parent_pid,
            "agent": agent,
            "agentId": jeikcode_session
        }).to_string();

        {
            let mut state = self.state.write().await;
            state.pending.insert(id, tx);
            if let Some(conn) = state.connections.last() {
                if let Err(e) = conn.tx.send(cmd_payload) {
                    state.pending.remove(&id);
                    return Err(format!("Failed to send to extension: {}", e));
                }
            } else {
                state.pending.remove(&id);
                return Err("No active extension connection available.".to_string());
            }
        }

        match tokio::time::timeout(Duration::from_millis(timeout_ms), rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => {
                let mut state = self.state.write().await;
                state.pending.remove(&id);
                Err("Extension closed channel before responding".to_string())
            }
            Err(_) => {
                let mut state = self.state.write().await;
                state.pending.remove(&id);
                Err(format!("Command timed out after {}ms: {}", timeout_ms, method))
            }
        }
    }
}
