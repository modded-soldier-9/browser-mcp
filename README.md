<p align="center">
  <img src="assets/logo.svg" width="128" height="128" alt="Browser MCP Logo">
</p>

# Browser MCP

[![CI](https://github.com/modded-soldier-9/browser-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/modded-soldier-9/browser-mcp/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/modded-soldier-9/browser-mcp?style=flat-square&color=blue)](https://github.com/modded-soldier-9/browser-mcp/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-browsermcp.dev-blueviolet.svg?style=flat-square)](https://browsermcp.dev/)

**A native, high-performance standalone Rust Model Context Protocol (MCP) server that connects AI coding assistants directly to your live, authenticated Brave and Chrome browser sessions.**

Engineered & maintained by **Mohamed Elsheikh** ([@modded-soldier-9](https://github.com/modded-soldier-9)). See [Architecture](ARCHITECTURE.md) and full [Documentation](https://browsermcp.dev/).

---

## What is Browser MCP?

Most AI browser automation frameworks rely on headless Playwright or Puppeteer instances that trigger Cloudflare bot blocks, break existing 2FA/SSO authenticated sessions, and flood LLM context windows with 35,000+ tokens of raw HTML on every step.

Browser MCP connects directly to your daily browser session through a native Rust server and persistent Manifest V2 WebSocket bridge:

- **🦀 Pure Rust Standalone Executable**: Single static binary (`browser-mcp.exe`). Boots in **< 4 ms** and idles at **~3.8 MB RAM** with zero external dependencies (Node.js eliminated).
- **📉 Token Shield & Semantic Pruning**: Semantic distillation (`format="interactive"`) delivers 400–1,200 token accessibility trees with monotonic handles (`[e1]`, `[e2]`). Automatic **Context Shield** spools oversized payloads (>2,500 tokens) to local disk with in-band pagination.
- **⚡ Spatial Viewport Filtering (`viewport_only=true`)**: Prunes off-screen nodes outside the active viewport, slashing token consumption by an additional **50–70%** on long feeds and infinite-scroll apps.
- **📝 Atomic Form Batching (`browser_fill`)**: Fills multi-field forms in a single atomic turn using `fields: [{ selector, value }]`, eliminating 5–10 sequential round-trips.
- **🎯 Targeted Element Search (`browser_search_elements`)**: Finds interactive buttons, links, and inputs by accessible label in **sub-100 tokens** without reading the whole page.
- **🔄 State Delta Streaming (`format="delta"`)**: Emits only added and removed interactive mutations following actions, cutting multi-turn token overhead by ~85%.
- **🔒 Loopback Origin Security**: Strictly enforces `Origin: chrome-extension://[a-p]{32}` across loopback ports `127.0.0.1:9876-9895` to block unauthorized local connections.
- **43 Tools Green**: Comprehensive coverage across navigation, DOM inspection, hardware CDP input, cookies, storage, and human-in-the-loop dialogs.

---

## Quick Start

### 1. Build & Install

**Option A — Pre-built Binary (Recommended):**
Download the latest executable for your OS from [GitHub Releases](https://github.com/modded-soldier-9/browser-mcp/releases), place `browser-mcp` in your `PATH`, and run:
```bash
browser-mcp install
```

**Option B — Build from Source:**
```bash
# Clone the repository
git clone https://github.com/modded-soldier-9/browser-mcp.git
cd browser-mcp

# Build native release binary
cargo build --release --manifest-path crates/browser-mcp-server/Cargo.toml

# Unpack extension assets into ~/.browser-mcp/extension
./target/release/browser-mcp install
```

### 2. Load Extension in Browser

1. Open `brave://extensions` or `chrome://extensions`.
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked** and select `~/.browser-mcp/extension` (or `%USERPROFILE%\.browser-mcp\extension` on Windows).

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
      "command": "browser-mcp"
    }
  }
}
```

#### Claude Desktop
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "browser-mcp"
    }
  }
}
```

---

## Tool Surface (43 tools)

Browser MCP provides 43 tools grouped by execution domain:

| Domain | Available Tools |
| :--- | :--- |
| **Navigation & Tabs** | `browser_navigate`, `browser_list_tabs`, `browser_get_new_tab`, `browser_switch_tab`, `browser_close_tab`, `browser_list_frames`, `browser_select_frame` |
| **Inspection & Content** | `browser_get_page_content`, `browser_search_elements`, `browser_extract_list`, `browser_screenshot`, `browser_console_logs`, `browser_about` |
| **Input & Interaction** | `browser_click`, `browser_click_xy`, `browser_double_click`, `browser_right_click`, `browser_fill`, `browser_press_key`, `browser_hover`, `browser_scroll` |
| **Forms & Files** | `browser_select_option`, `browser_set_combobox`, `browser_set_date`, `browser_upload_file`, `browser_drop_file` |
| **Storage & State** | `browser_get_cookies`, `browser_set_cookies`, `browser_get_local_storage`, `browser_set_local_storage`, `browser_extract_token` |
| **Network & Overlays** | `browser_fetch`, `browser_wait`, `browser_wait_for_network`, `browser_get_failed_requests`, `browser_highlight`, `browser_handle_dialog`, `browser_dismiss_overlays`, `browser_reattach_debugger` |
| **User Interaction** | `browser_ask_user`, `browser_solve_captcha`, `browser_execute_script`, `browser_provide_feedback` |

---

## License

MIT License © 2026 **Mohamed Elsheikh** ([@modded-soldier-9](https://github.com/modded-soldier-9)).
