# Browser MCP

**A native, standalone Rust Model Context Protocol (MCP) server that connects AI coding assistants directly to your live, authenticated Brave and Chrome browser sessions.**

Created and maintained by **Mohamed Elsheikh** ([@modded-soldier-9](https://github.com/modded-soldier-9)).

---

## Why Browser MCP?

Most AI browser tools rely on headless instances that trigger Cloudflare bot walls, break authenticated sessions, and burn 20,000+ tokens per interaction. Browser MCP automates your real daily browser profile with zero friction:

- **🦀 Pure Rust Standalone Executable**: Single 3.07 MB static binary (`browser-mcp.exe`). Boots in **< 4 ms** and idles at **~3.8 MB RAM** with zero external dependencies (Node.js eliminated).
- **⚡ Non-Blocking Stdio Engine**: Asynchronous Tokio loop answers MCP `ping` keep-alives on a dedicated sub-millisecond fast path, eliminating client timeout disconnects during heavy browser actions.
- **🛡️ Manifest V2 Persistent Longevity**: Runs as a persistent MV2 background worker, avoiding the 30-second service-worker idle disconnects of Manifest V3.
- **📉 95% Token Reduction**: Generates compact semantic accessibility snapshots (`format="snapshot"`) with direct element handles (`[e1]`, `[e2]`) instead of massive raw HTML dumps.
- **📦 Embedded Self-Installer**: Embeds the extension assets inside the binary. Run `browser-mcp install` to extract and configure your environment in 50 ms.
- **🔒 Loopback Origin Security**: Rejects unauthorized local connections, strictly enforcing `Origin: chrome-extension://[a-p]{32}` across loopback ports `127.0.0.1:9876-9895`.
- **40 Tools Green**: Complete coverage across navigation, DOM inspection, CDP hardware input, form controls, cookies, and human-in-the-loop dialogs.

---

## Quick Start

### 1. Build or Install
```bash
# Clone the repository
git clone https://github.com/modded-soldier-9/browser-mcp.git
cd browser-mcp

# Build native binary
cargo build --release --manifest-path crates/browser-mcp-server/Cargo.toml

# Run self-installer to unpack extension
./target/release/browser-mcp install
```

### 2. Load Extension in Browser
1. Open `brave://extensions` or `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select `~/.browser-mcp/extension` (or `./extension`).

### 3. Connect Your AI Assistant

#### Claude Code
```bash
claude mcp add browser-mcp -- browser-mcp
```

#### Cursor (`~/.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "browser-mcp"
    }
  }
}
```

#### Antigravity (`~/.gemini/config/mcp_config.json`)
```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "C:\\Users\\modded\\Documents\\GitHub\\browser-mcp\\target\\release\\browser-mcp.exe"
    }
  }
}
```

---

## Tool Surface (40 tools)

Browser MCP provides 40 tools grouped by execution domain:

| Domain | Available Tools |
| :--- | :--- |
| **Navigation & Tabs** | `browser_navigate`, `browser_list_tabs`, `browser_get_new_tab`, `browser_switch_tab`, `browser_close_tab`, `browser_list_frames`, `browser_select_frame` |
| **Inspection & Content** | `browser_get_page_content`, `browser_extract_list`, `browser_screenshot`, `browser_console_logs`, `browser_about` |
| **Input & Interaction** | `browser_click`, `browser_click_xy`, `browser_double_click`, `browser_right_click`, `browser_fill`, `browser_press_key`, `browser_hover`, `browser_scroll` |
| **Forms & Files** | `browser_select_option`, `browser_set_combobox`, `browser_set_date`, `browser_upload_file`, `browser_drop_file` |
| **Storage & State** | `browser_get_cookies`, `browser_set_cookies`, `browser_get_local_storage`, `browser_set_local_storage`, `browser_extract_token` |
| **Network & Overlays** | `browser_fetch`, `browser_wait`, `browser_wait_for_network`, `browser_handle_dialog`, `browser_dismiss_overlays`, `browser_reattach_debugger` |
| **User Interaction** | `browser_ask_user`, `browser_solve_captcha`, `browser_execute_script`, `browser_provide_feedback` |

---

## License

MIT License © 2026 **Mohamed Elsheikh** ([@modded-soldier-9](https://github.com/modded-soldier-9)).
