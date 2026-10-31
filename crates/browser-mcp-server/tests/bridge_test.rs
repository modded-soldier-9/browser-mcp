use browser_mcp_server::bridge::Bridge;
use browser_mcp_server::protocol::{JsonRpcRequest, JsonRpcResponse};
use browser_mcp_server::tools::{get_tools_list, handle_local_tool, is_local_tool, normalize_tool_name};
use serde_json::json;

#[tokio::test]
async fn test_tools_count_and_schema() {
    let tools = get_tools_list(false);
    assert_eq!(tools.len(), 40, "Expected exactly 40 tools in tools_schema.json");

    let stripped_tools = get_tools_list(true);
    assert_eq!(stripped_tools.len(), 40);
    let first_name = stripped_tools[0]["name"].as_str().unwrap();
    assert_eq!(first_name, "navigate");
}

#[tokio::test]
async fn test_tool_name_normalization() {
    assert_eq!(normalize_tool_name("navigate"), "browser_navigate");
    assert_eq!(normalize_tool_name("browser_navigate"), "browser_navigate");
    assert_eq!(normalize_tool_name("unknown_tool"), "unknown_tool");
}

#[tokio::test]
async fn test_local_tools_identification() {
    assert!(is_local_tool("about"));
    assert!(is_local_tool("provide_feedback"));
    assert!(!is_local_tool("navigate"));
    assert!(!is_local_tool("extract_token"));
}

#[tokio::test]
async fn test_local_tool_about_execution() {
    let res = handle_local_tool("about", &json!({}), Some(9876), 1, vec!["default".to_string()]).await;
    assert!(res.is_ok());
    let val = res.unwrap();
    assert_eq!(val["name"], "browser-mcp");
    assert_eq!(val["version"], env!("CARGO_PKG_VERSION"));
    assert_eq!(val["runtime"], "rust");
    assert_eq!(val["port"], 9876);
    assert_eq!(val["connected_extensions"], 1);
}

#[tokio::test]
async fn test_local_tool_feedback_validation() {
    let empty_feedback = handle_local_tool("provide_feedback", &json!({ "feedback": "" }), None, 0, vec![]).await;
    assert!(empty_feedback.is_err());

    let valid_feedback = handle_local_tool("provide_feedback", &json!({ "feedback": "Rust rewrite test feedback" }), None, 0, vec![]).await;
    assert!(valid_feedback.is_ok());
    let val = valid_feedback.unwrap();
    assert_eq!(val["status"], "received");
}

#[tokio::test]
async fn test_bridge_ensure_port() {
    let bridge = Bridge::new();
    let port_res = bridge.ensure_port().await;
    assert!(port_res.is_ok(), "Bridge should successfully bind to an available loopback port");
    let port = port_res.unwrap();
    assert!(port >= 9876 && port <= 9895, "Port must be in range 9876..=9895");

    let (active_port, clients, _) = bridge.get_status().await;
    assert_eq!(active_port, Some(port));
    assert_eq!(clients, 0);
}

#[tokio::test]
async fn test_jsonrpc_ping_serialization() {
    let raw = r#"{"jsonrpc":"2.0","id":42,"method":"ping"}"#;
    let req: JsonRpcRequest = serde_json::from_str(raw).expect("Must parse JSON-RPC request");
    assert_eq!(req.method, "ping");
    assert_eq!(req.id, Some(json!(42)));

    let resp = JsonRpcResponse {
        jsonrpc: "2.0".to_string(),
        id: json!(42),
        result: Some(json!({})),
        error: None,
    };
    let serialized = serde_json::to_string(&resp).expect("Must serialize");
    assert_eq!(serialized, r#"{"jsonrpc":"2.0","id":42,"result":{}}"#);
}
