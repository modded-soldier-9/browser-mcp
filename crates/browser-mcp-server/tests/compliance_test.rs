use std::collections::HashSet;
use std::sync::Arc;
use browser_control_server::bridge::Bridge;
use browser_control_server::protocol::{CallToolResult, ImageContent, JsonRpcError, JsonRpcResponse, TextContent, ToolContent};
use browser_control_server::tools::{get_tools_list, normalize_tool_name, METHOD_MAP};
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;

#[test]
fn test_all_43_tools_schema_mcp_compliance() {
    let raw_tools = get_tools_list(false);
    assert_eq!(raw_tools.len(), 43, "Must have exactly 43 tools defined");

    let mut tool_names = HashSet::new();

    for tool in &raw_tools {
        // 1. Tool object must have name and description
        let name = tool.get("name").and_then(|v| v.as_str()).expect("Tool name must be a string");
        assert!(name.starts_with("browser_"), "Tool name must start with browser_: {}", name);
        assert!(tool_names.insert(name.to_string()), "Duplicate tool name found: {}", name);

        let desc = tool.get("description").and_then(|v| v.as_str()).expect("Tool description must be a string");
        assert!(!desc.trim().is_empty(), "Tool description must not be empty: {}", name);

        // 2. inputSchema must be a valid JSON Schema object with type: "object"
        let schema = tool.get("inputSchema").expect("inputSchema must exist");
        assert_eq!(schema.get("type").and_then(|v| v.as_str()), Some("object"), "inputSchema.type must be object for {}", name);

        // 3. Properties, if present, must be an object
        if let Some(props) = schema.get("properties") {
            assert!(props.is_object(), "properties must be an object for {}", name);
            if let Some(props_obj) = props.as_object() {
                for (prop_name, prop_val) in props_obj {
                    assert!(prop_val.is_object(), "Property {} of {} must be an object", prop_name, name);
                }
            }
        }

        // 4. Required, if present, must be an array of strings referencing declared properties
        if let Some(required) = schema.get("required") {
            assert!(required.is_array(), "required must be an array for {}", name);
            let props_obj = schema.get("properties").and_then(|v| v.as_object());
            for req in required.as_array().unwrap() {
                let req_field = req.as_str().expect("required elements must be strings");
                assert!(
                    props_obj.is_some_and(|p| p.contains_key(req_field)),
                    "required field '{}' in tool '{}' not found in properties",
                    req_field,
                    name
                );
            }
        }

        // 5. Tool must be mapped in METHOD_MAP
        assert!(METHOD_MAP.contains_key(name), "Tool {} missing from METHOD_MAP", name);

        // 6. Tool normalization
        let stripped = name.strip_prefix("browser_").unwrap();
        assert_eq!(normalize_tool_name(name), name);
        assert_eq!(normalize_tool_name(stripped), name);
    }
}

#[test]
fn test_jsonrpc_serialization_standards() {
    // 1. Success response serialization
    let ok_resp = JsonRpcResponse {
        jsonrpc: "2.0".to_string(),
        id: json!(10),
        result: Some(json!({ "status": "ok" })),
        error: None,
    };
    let ok_str = serde_json::to_string(&ok_resp).unwrap();
    assert!(ok_str.contains(r#""jsonrpc":"2.0""#));
    assert!(ok_str.contains(r#""id":10"#));
    assert!(ok_str.contains(r#""result":{"status":"ok"}"#));
    assert!(!ok_str.contains(r#""error""#), "Success response MUST NOT serialize error key");

    // 2. Error response serialization
    let err_resp = JsonRpcResponse {
        jsonrpc: "2.0".to_string(),
        id: json!("req-abc"),
        result: None,
        error: Some(JsonRpcError {
            code: -32601,
            message: "Method not found: foo".to_string(),
            data: None,
        }),
    };
    let err_str = serde_json::to_string(&err_resp).unwrap();
    assert!(err_str.contains(r#""jsonrpc":"2.0""#));
    assert!(err_str.contains(r#""id":"req-abc""#));
    assert!(err_str.contains(r#""code":-32601"#));
    assert!(err_str.contains(r#""message":"Method not found: foo""#));
    assert!(!err_str.contains(r#""result""#), "Error response MUST NOT serialize result key");

    // 3. CallToolResult text content
    let text_res = CallToolResult {
        content: vec![ToolContent::Text(TextContent {
            content_type: "text".to_string(),
            text: "Hello MCP".to_string(),
        })],
        is_error: None,
    };
    let text_val = serde_json::to_value(&text_res).unwrap();
    assert_eq!(text_val["content"][0]["type"], "text");
    assert_eq!(text_val["content"][0]["text"], "Hello MCP");
    assert!(text_val.get("isError").is_none(), "isError omitted when None");

    // 4. CallToolResult image content
    let img_res = CallToolResult {
        content: vec![ToolContent::Image(ImageContent {
            content_type: "image".to_string(),
            data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==".to_string(),
            mime_type: "image/png".to_string(),
        })],
        is_error: None,
    };
    let img_val = serde_json::to_value(&img_res).unwrap();
    assert_eq!(img_val["content"][0]["type"], "image");
    assert_eq!(img_val["content"][0]["mimeType"], "image/png");

    // 5. CallToolResult with isError = true
    let err_tool_res = CallToolResult {
        content: vec![ToolContent::Text(TextContent {
            content_type: "text".to_string(),
            text: "Execution failed".to_string(),
        })],
        is_error: Some(true),
    };
    let err_tool_val = serde_json::to_value(&err_tool_res).unwrap();
    assert_eq!(err_tool_val["isError"], true);
}

#[tokio::test]
async fn test_all_tools_bridge_dispatch_and_framing() {
    // Spin up bridge on test port
    unsafe {
        std::env::set_var("BROWSER_MCP_BASE_PORT", "9890");
        std::env::set_var("BROWSER_MCP_MAX_PORT", "9895");
    }
    let bridge = Arc::new(Bridge::new());
    let port = bridge.ensure_port().await.expect("Must bind port");

    // Connect mock extension WebSocket client
    let url = format!("ws://127.0.0.1:{}/ws", port);
    let mut req = url.into_client_request().unwrap();
    req.headers_mut().insert(
        "Origin",
        "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".parse().unwrap(),
    );

    let (ws_stream, _) = connect_async(req).await.expect("Failed to connect mock extension");
    let (mut ws_tx, mut ws_rx) = ws_stream.split();

    // Send hello handshake from extension
    ws_tx.send(tokio_tungstenite::tungstenite::Message::Text(json!({
        "type": "hello",
        "extensionId": "mock-extension",
        "version": "1.0.0",
        "profile": "default"
    }).to_string())).await.expect("Failed to send hello");

    // Background responder for mock extension: echoes back success for any command
    let responder = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_rx.next().await {
            if let tokio_tungstenite::tungstenite::Message::Text(text) = msg {
                let parsed: Value = match serde_json::from_str(&text) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                if let Some(id) = parsed.get("id").and_then(|v| v.as_u64()) {
                    let method = parsed.get("method").and_then(|v| v.as_str()).unwrap_or("");
                    let resp = json!({
                        "id": id,
                        "success": true,
                        "method": method,
                        "result": { "echo_method": method }
                    });
                    let _ = ws_tx.send(tokio_tungstenite::tungstenite::Message::Text(resp.to_string())).await;
                }
            }
        }
    });

    // Give handshake a moment to settle
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;

    // Verify all 43 tools dispatch and return valid response framing
    for tool_name in METHOD_MAP.keys() {
        let method = METHOD_MAP.get(tool_name).unwrap();
        if browser_control_server::tools::is_local_tool(method) {
            // Local tool test
            let (active_port, clients, profiles) = bridge.get_status().await;
            let res = browser_control_server::tools::handle_local_tool(method, &json!({ "feedback": "test" }), active_port, clients, profiles).await;
            assert!(res.is_ok(), "Local tool {} should succeed", method);
        } else {
            // Remote tool test via bridge
            let res = bridge.send_command(method, json!({}), 2000).await;
            assert!(res.is_ok(), "Tool {} should successfully dispatch through bridge: {:?}", method, res.err());
            let val = res.unwrap();
            assert_eq!(val["echo_method"], *method, "Echoed method must match for {}", tool_name);
        }
    }

    responder.abort();
}
