use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::LazyLock;
use serde_json::{json, Value};

pub static TOOLS_JSON: &str = include_str!("../tools_schema.json");

pub static TOOLS_RAW: LazyLock<Vec<Value>> = LazyLock::new(|| {
    serde_json::from_str(TOOLS_JSON).expect("tools_schema.json must be valid JSON")
});

pub static METHOD_MAP: LazyLock<HashMap<&'static str, &'static str>> = LazyLock::new(|| {
    let mut m = HashMap::new();
    m.insert("browser_navigate", "navigate");
    m.insert("browser_get_page_content", "get_page_content");
    m.insert("browser_extract_list", "extract_list");
    m.insert("browser_screenshot", "screenshot");
    m.insert("browser_execute_script", "execute_script");
    m.insert("browser_double_click", "double_click");
    m.insert("browser_right_click", "right_click");
    m.insert("browser_click_xy", "click_xy");
    m.insert("browser_reattach_debugger", "reattach_debugger");
    m.insert("browser_click", "click");
    m.insert("browser_fill", "fill");
    m.insert("browser_press_key", "press_key");
    m.insert("browser_scroll", "scroll");
    m.insert("browser_wait", "wait");
    m.insert("browser_hover", "hover");
    m.insert("browser_select_option", "select_option");
    m.insert("browser_dismiss_overlays", "dismiss_overlays");
    m.insert("browser_set_combobox", "set_combobox");
    m.insert("browser_drop_file", "drop_file");
    m.insert("browser_set_date", "set_date");
    m.insert("browser_handle_dialog", "handle_dialog");
    m.insert("browser_wait_for_network", "wait_for_network");
    m.insert("browser_fetch", "fetch");
    m.insert("browser_list_tabs", "list_tabs");
    m.insert("browser_get_cookies", "get_cookies");
    m.insert("browser_get_local_storage", "get_local_storage");
    m.insert("browser_set_cookies", "set_cookies");
    m.insert("browser_set_local_storage", "set_local_storage");
    m.insert("browser_console_logs", "console_logs");
    m.insert("browser_ask_user", "ask_user");
    m.insert("browser_list_frames", "list_frames");
    m.insert("browser_select_frame", "select_frame");
    m.insert("browser_get_new_tab", "get_new_tab");
    m.insert("browser_switch_tab", "switch_tab");
    m.insert("browser_close_tab", "close_tab");
    m.insert("browser_upload_file", "upload_file");
    m.insert("browser_extract_token", "extract_token");
    m.insert("browser_solve_captcha", "solve_captcha");
    m.insert("browser_about", "about");
    m.insert("browser_provide_feedback", "provide_feedback");
    m
});

pub fn get_tools_list(strip_prefix: bool) -> Vec<Value> {
    if !strip_prefix {
        return TOOLS_RAW.clone();
    }
    TOOLS_RAW.iter().map(|tool| {
        let mut t = tool.clone();
        if let Some(name) = t.get("name").and_then(|v| v.as_str()) {
            if let Some(stripped) = name.strip_prefix("browser_") {
                t["name"] = Value::String(stripped.to_string());
            }
        }
        t
    }).collect()
}

pub fn normalize_tool_name(name: &str) -> String {
    if !name.starts_with("browser_") {
        let prefixed = format!("browser_{}", name);
        if METHOD_MAP.contains_key(prefixed.as_str()) {
            return prefixed;
        }
    }
    name.to_string()
}

pub fn is_local_tool(method: &str) -> bool {
    method == "about" || method == "provide_feedback"
}

pub async fn handle_local_tool(
    method: &str,
    args: &Value,
    active_port: Option<u16>,
    connected_clients: usize,
    profiles: Vec<String>,
) -> Result<Value, String> {
    match method {
        "about" => Ok(json!({
            "name": "browser-mcp",
            "version": env!("CARGO_PKG_VERSION"),
            "description": "Native standalone Rust MCP server driving Brave and Chrome",
            "runtime": "rust",
            "os": std::env::consts::OS,
            "arch": std::env::consts::ARCH,
            "port": active_port,
            "connected_extensions": connected_clients,
            "active_profiles": profiles
        })),
        "provide_feedback" => {
            let feedback = args.get("feedback")
                .or_else(|| args.get("message"))
                .or_else(|| args.get("text"))
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if feedback.trim().is_empty() {
                return Err("Missing feedback content in request".to_string());
            }

            let home = std::env::var("USERPROFILE")
                .or_else(|_| std::env::var("HOME"))
                .unwrap_or_else(|_| ".".to_string());
            let dir = PathBuf::from(home).join(".browser-mcp");
            let _ = std::fs::create_dir_all(&dir);
            let log_file = dir.join("feedback.log");

            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);

            let entry = format!("[{}] {}\n", timestamp, feedback);
            if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_file) {
                let _ = file.write_all(entry.as_bytes());
            }

            Ok(json!({
                "status": "received",
                "logged_to": log_file.display().to_string(),
                "message": "Thank you for the feedback. Logged locally."
            }))
        }
        _ => Err(format!("Unknown local tool method: {}", method)),
    }
}
