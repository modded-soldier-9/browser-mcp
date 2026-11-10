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
use url::form_urlencoded;

pub fn validate_auth_token(req: &Request, token_opt: Option<&str>) -> bool {
    let required_token = match token_opt {
        Some(t) => t,
        None => return true,
    };

    if required_token.trim().is_empty() {
        return false;
    }

    let uri_token_match = req
        .uri()
        .query()
        .is_some_and(|q| form_urlencoded::parse(q.as_bytes()).any(|(k, v)| k == "token" && v == required_token));

    let header_token_match = req
        .headers()
        .get("Sec-WebSocket-Protocol")
        .and_then(|v| v.to_str().ok())
        .is_some_and(|p| p.split(',').any(|part| part.trim() == required_token));

    uri_token_match || header_token_match
}

pub const DEFAULT_BASE_PORT: u16 = 9876;
pub const DEFAULT_MAX_PORT: u16 = 9895;

#[derive(Clone)]
pub struct ExtensionConnection {
    pub seq: u64,
    pub extension_id: String,
    pub version: Option<String>,
    pub name: Option<String>,
    pub profile: String,
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

    pub async fn get_status(&self) -> (Option<u16>, usize, Vec<String>) {
        let state = self.state.read().await;
        let profiles = state.connections.iter().map(|c| c.profile.clone()).collect();
        (state.active_port, state.connections.len(), profiles)
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
        let expected_token = std::env::var("BROWSER_MCP_TOKEN").ok();

        while let Ok((mut stream, _)) = listener.accept().await {
            let origin_re = origin_regex.clone();
            let bridge = self.clone();
            let token_opt = expected_token.clone();

            tokio::spawn(async move {
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

                #[allow(clippy::result_large_err)]
                let callback = move |req: &Request, response: Response| {
                    if !validate_auth_token(req, token_opt.as_deref()) {
                        return Err(Response::builder()
                            .status(401)
                            .body(Some("Invalid authentication token".to_string()))
                            .unwrap());
                    }

                    let origin_valid = req.headers().get("Origin")
                        .and_then(|o| o.to_str().ok())
                        .map(|s| origin_re.is_match(s))
                        .unwrap_or(false);
                    if origin_valid {
                        return Ok(response);
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
                profile: "default".to_string(),
                tx: out_tx.clone(),
            };
            state.connections.push(conn);
            seq
        };

        eprintln!("[MCP] Chrome extension connected on port {}", port);

        // Task to write outgoing frames to WebSocket
        let write_task = tokio::spawn(async move {
            while let Some(msg) = out_rx.recv().await {
                if ws_sender.send(Message::Text(msg)).await.is_err() {
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
                            if let Some(prof) = parsed.get("profile").and_then(|v| v.as_str()) {
                                let clean = prof.trim().to_string();
                                if !clean.is_empty() {
                                    c.profile = clean;
                                }
                            }
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
                return Err("Chrome extension not connected after 5 seconds. Check Brave/Chrome is open and Browser MCP extension is loaded.".to_string());
            }
            tokio::time::sleep(Duration::from_millis(200)).await;
        }

        let (tx, rx) = oneshot::channel();
        let id = self.cmd_id.fetch_add(1, Ordering::SeqCst);

        let parent_pid = std::process::id();
        let session_id = std::env::var("BROWSER_MCP_SESSION_ID")
            .or_else(|_| std::env::var("JEIKCODE_SESSION_ID"))
            .unwrap_or_else(|_| "browser-mcp".to_string());
        let agent = std::env::var("BROWSER_MCP_AGENT").unwrap_or_else(|_| "browser-mcp".to_string());

        let cmd_payload = json!({
            "id": id,
            "method": method,
            "params": params,
            "pid": parent_pid,
            "agent": agent,
            "agentId": session_id
        }).to_string();

        let requested_profile = std::env::var("BROWSER_MCP_PROFILE")
            .ok()
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty());

        {
            let mut state = self.state.write().await;
            let conn_to_send = if let Some(ref req_prof) = requested_profile {
                state.connections.iter().rev().find(|c| c.profile.to_lowercase() == *req_prof).cloned()
            } else {
                state.connections.last().cloned()
            };

            if let Some(conn) = conn_to_send {
                state.pending.insert(id, tx);
                if let Err(e) = conn.tx.send(cmd_payload) {
                    state.pending.remove(&id);
                    return Err(format!("Failed to send to extension: {}", e));
                }
            } else if let Some(ref req_prof) = requested_profile {
                let available: Vec<String> = state.connections.iter().map(|c| c.profile.clone()).collect();
                return Err(format!(
                    "No browser extension connected with profile \"{}\". Connected browser profiles: {:?}. Set BROWSER_MCP_PROFILE or change profile in the Browser MCP popup.",
                    req_prof, available
                ));
            } else {
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

impl Default for Bridge {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_token_none_required() {
        let req = Request::builder().uri("/").body(()).unwrap();
        assert!(validate_auth_token(&req, None));
    }

    #[test]
    fn test_auth_token_empty_string_rejected() {
        // If BROWSER_MCP_TOKEN is set to empty or whitespace, cannot be bypassed
        let req_empty_query = Request::builder().uri("/?token=").body(()).unwrap();
        assert!(!validate_auth_token(&req_empty_query, Some("")));
        assert!(!validate_auth_token(&req_empty_query, Some("   ")));

        let req_valid_looking = Request::builder().uri("/?token=secret").body(()).unwrap();
        assert!(!validate_auth_token(&req_valid_looking, Some("")));

        let req_no_token = Request::builder().uri("/").body(()).unwrap();
        assert!(!validate_auth_token(&req_no_token, Some("")));
    }

    #[test]
    fn test_auth_token_exact_query_match() {
        let req_exact = Request::builder().uri("/?token=secret_123").body(()).unwrap();
        assert!(validate_auth_token(&req_exact, Some("secret_123")));

        let req_with_other_params = Request::builder().uri("/?profile=default&token=secret_123&v=1").body(()).unwrap();
        assert!(validate_auth_token(&req_with_other_params, Some("secret_123")));

        // Substring / prefix / suffix must NOT match
        let req_prefix = Request::builder().uri("/?token=secret_123_extra").body(()).unwrap();
        assert!(!validate_auth_token(&req_prefix, Some("secret_123")));

        let req_sub = Request::builder().uri("/?token=secret").body(()).unwrap();
        assert!(!validate_auth_token(&req_sub, Some("secret_123")));

        let req_wrong_key = Request::builder().uri("/?not_token=secret_123").body(()).unwrap();
        assert!(!validate_auth_token(&req_wrong_key, Some("secret_123")));
    }

    #[test]
    fn test_auth_token_header_protocol_exact_match() {
        let req_single = Request::builder()
            .uri("/")
            .header("Sec-WebSocket-Protocol", "secret_123")
            .body(())
            .unwrap();
        assert!(validate_auth_token(&req_single, Some("secret_123")));

        let req_multi = Request::builder()
            .uri("/")
            .header("Sec-WebSocket-Protocol", "mcp, secret_123, v1")
            .body(())
            .unwrap();
        assert!(validate_auth_token(&req_multi, Some("secret_123")));

        // Substring in header must NOT match
        let req_substring = Request::builder()
            .uri("/")
            .header("Sec-WebSocket-Protocol", "mcp, secret_1234, v1")
            .body(())
            .unwrap();
        assert!(!validate_auth_token(&req_substring, Some("secret_123")));
    }
}
