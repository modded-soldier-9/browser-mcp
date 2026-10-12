<div align="center">
  <img src="./assets/logo.svg" alt="Browser MCP Logo" width="128" />
  <h1>Browser MCP (v2.0.0)</h1>
  <p><strong>Native Rust & Node Dual-Engine · Extreme KV-Cache Discipline · Real Authenticated Browser Bridge (Brave & Chrome)</strong></p>
  <p>
    <em>High-performance, token-efficient browser automation bridge connecting AI coding agents directly to your real, authenticated browser session with human-in-the-loop safeguards.</em>
  </p>
  <p>
    <strong>Author: Mohamed Elsheikh (<a href="https://github.com/modded-soldier-9">@modded-soldier-9</a>)</strong>
  </p>
  <p>
    <a href="https://github.com/modded-soldier-9/browser-mcp/releases" target="_blank">
      <img src="https://img.shields.io/github/v/release/modded-soldier-9/browser-mcp?color=blue&label=version" alt="version">
    </a>
    <img src="https://img.shields.io/badge/rust-1.80%2B-orange.svg" alt="rust">
    <img src="https://img.shields.io/badge/node-%3E%3D20-green.svg" alt="node">
    <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="license">
    <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg" alt="platform">
    <img src="https://img.shields.io/badge/quality-86%2F86%20tests%20green-emerald.svg" alt="tests">
    <a href="https://github.com/modded-soldier-9/browser-mcp" target="_blank">
      <img src="https://img.shields.io/github/stars/modded-soldier-9/browser-mcp?style=social" alt="GitHub Stars"/>
    </a>
  </p>
  <p>
    <a href="https://github.com/modded-soldier-9/browser-mcp">
      <img src="https://img.shields.io/badge/⭐_Star_on_GitHub-Support_Project-2563eb?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Repo">
    </a>
    <a href="https://github.com/modded-soldier-9/browser-mcp/releases">
      <img src="https://img.shields.io/badge/📥_Download_Releases-Latest-0ea5e9?style=for-the-badge" alt="Releases">
    </a>
  </p>
  <p>
    🌐 <strong>Source Repository</strong>: <a href="https://github.com/modded-soldier-9/browser-mcp"><strong>https://github.com/modded-soldier-9/browser-mcp</strong></a>
  </p>
  <!-- latest release v2.0.0 (2026-10-11) -->
  <p>
    <a href="https://github.com/modded-soldier-9/browser-mcp">
      <img src="https://raw.githubusercontent.com/Agent360dk/browser-mcp/main/assets/demo.gif" alt="Browser MCP Demo" />
    </a>
  </p>
  <p>
    <a href="https://github.com/modded-soldier-9/browser-mcp">
      ![Browser MCP Demo](https://raw.githubusercontent.com/Agent360dk/browser-mcp/main/assets/demo.gif)
    </a>
  </p>
</div>

---

## 📌 What is Browser MCP?

**Browser MCP** is a next-generation, high-performance browser automation bridge built specifically for modern AI coding agents (JeikCode, Claude Code, Cursor, OpenCode, Codex). Unlike headless testing frameworks (Playwright, Puppeteer) that spin up empty guest profiles blocked by Cloudflare, SSO, or bot-detection walls, **Browser MCP connects directly to your live, daily Brave or Chrome browser**.

- 🦀 **Native Compiled Rust Engine (`bin/browser-mcp.exe`)**: Boots in **<4 ms** with an ultra-low **~3.8 MB RAM** footprint (a 92% memory reduction over Node.js). Zero runtime dependencies, single static binary;
- 🔍 **Semantic Accessibility Snapshotting (`format="snapshot"`)**: Extracts a compact, indented accessibility tree (AXTree) with deterministic element handles (`[e1]`, `[e2]`, `[e3]`), slashing token consumption by **95%** compared to raw HTML dumps;
- 🎯 **Zero-Guessing Direct Element Targeting**: Pass snapshot handles directly into interaction tools (`browser_click("e1")`, `browser_fill("e2", "...")`), completely eliminating fragile CSS/XPath guesswork;
- 🛡️ **Brave & Chrome MV2 Persistent Background Worker**: Rock-solid Manifest V2 persistent background architecture with Universal Promise Promisifier, bypassing the 30-second service-worker idle disconnects of MV3;
- 🧩 **Multi-Agent Session Isolation**: Dynamic 20-port WebSocket pool (9876 to 9895) allocates each conversation turn into its own color-coded tab group (`JeikCode 1`, `JeikCode 2`, etc.), preventing cross-session contamination;
- 👥 **Deterministic Multi-Profile Routing (`BROWSER_MCP_PROFILE`)**: Running multiple Chrome or Brave profiles (e.g. Work vs Personal)? Assign profile labels directly in the popup and set `BROWSER_MCP_PROFILE=work` in your agent environment. Agents route exclusively to their designated profile without cross-account contamination;
- ⚡ **Styled Toggles & Complex UI Handling**: Automatic `<label>` fallback for zero-dimension styled switches (Radix, Shadcn, Tailwind, Fluent UI), and automatic top-level `await` wrapping in `browser_execute_script`;
- 🔒 **Human-in-the-Loop Safeguards**: Integrated `browser_ask_user` displays non-intrusive in-viewport dialogs when 2FA codes, SMS authenticators, or user confirmations are needed. Credentials are never guessed.

---

## ⚡ Performance Benchmarks: Rust Engine vs. Node.js

| Metric | Legacy Node.js Server | Native Rust Server (`browser-mcp.exe`) | Improvement |
|---|---|---|---|
| **Cold-Start Boot Latency** | ~280 ms to 420 ms | **< 4 ms** | **~90x faster startup** |
| **Idle RAM per Session** | ~48 MB to 62 MB | **~ 3.8 MB** | **~92% memory reduction** |
| **RAM for 10 Sessions** | ~550 MB | **~ 38 MB** | **~510 MB saved** |
| **Binary Deployment** | Multi-file npm package + `node_modules` | **Single static executable (`browser-mcp.exe`)** | **Zero dependencies** |
| **Node.js / npm Prerequisite** | Required on host machine | **Zero (Runs standalone)** | **No npm deprecation warnings** |
| **Concurrency Model** | Node single-threaded event loop | Multi-threaded Tokio async scheduler | Sub-millisecond dispatch |

---

## 🏗️ Architecture Pipeline

```
┌────────────────────────────────────────────────────────┐
│      AI Coding Agent (JeikCode / Claude / Cursor)      │
└───────────────────────────┬────────────────────────────┘
                            │ (stdio JSON-RPC 2.0)
┌───────────────────────────▼────────────────────────────┐
│   Browser MCP Host Engine (Rust Binary / Node CLI)     │
│   • Port Pool Router (127.0.0.1:9876..9895)            │
│   • Canonical Path Sandbox & Process Watchdog          │
│   • Stdio Dispatcher & JSON-RPC 2.0 Response Correlator│
└───────────────────────────┬────────────────────────────┘
                            │ (WebSocket ws://127.0.0.1:9876)
┌───────────────────────────▼────────────────────────────┐
│      Brave / Chrome Extension (bhodhmddadehjc...)      │
│   • Persistent MV2 Background Worker                   │
│   • Chrome DevTools Protocol (CDP 1.3) Dispatcher      │
│   • Semantic Accessibility Tree (AXTree) Generator     │
│   • Color-Coded Tab Group Session Isolation            │
└───────────────────────────┬────────────────────────────┘
                            │ (Hardware CDP Events)
┌───────────────────────────▼────────────────────────────┐
│        Live Browser Tabs (Real Profile & Cookies)      │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start & Installation

### 1. Zero-Friction Native Installation (JeikCode / Universal)

Install the global package and automatically register with all your installed clients:
```bash
npx browser-mcp install
```
Or build the high-performance native Rust binary:
```bash
cd crates/browser-mcp-server
cargo build --release
```

### 2. Load Extension in Brave or Chrome (One Time Only)
1. Open Brave (`brave://extensions`) or Chrome (`chrome://extensions`).
2. Toggle **Developer mode** in the top-right corner.
3. Click **Load unpacked** (top-left).
4. Select the extension directory:
   - Windows: `%USERPROFILE%\.browser-mcp\extension\` (or `browser-mcp/extension/`)
   - macOS / Linux: `~/.browser-mcp/extension/`

### 3. Client Configurations

#### JeikCode (Global `~/.jeikcode/mcp.json`)
```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "C:/Users/modded/Documents/GitHub/browser-mcp/bin/browser-mcp.exe",
      "args": [],
      "timeout_ms": 30000,
      "maxConcurrentCalls": 1,
      "scope": "session"
    }
  }
}
```

#### Claude Code
```bash
claude mcp add --scope user browser-mcp -- C:/Users/modded/Documents/GitHub/browser-mcp/bin/browser-mcp.exe
```

#### Cursor (`~/.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "C:/Users/modded/Documents/GitHub/browser-mcp/bin/browser-mcp.exe",
      "args": []
    }
  }
}
```

#### OpenCode (`~/.config/opencode/opencode.json`)
```json
{
  "mcp": {
    "browser-mcp": {
      "type": "local",
      "command": ["C:/Users/modded/Documents/GitHub/browser-mcp/bin/browser-mcp.exe"],
      "enabled": true
    }
  }
}
```

---

## 40 Tools

### Navigation & Content
| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to URL (reuses tab, or `new_tab=true`) |
| `browser_get_page_content` | Get page text, HTML, or semantic accessibility snapshot (`format="snapshot"`) |
| `browser_screenshot` | Screenshot via Chrome Debugger (works even when tab isn't focused) |
| `browser_execute_script` | Run JavaScript in page context with top-level await support |
| `browser_extract_list` | Read every row of a long/virtualised list by scrolling its container until no new rows appear |

### Interaction
| Tool | Description |
|------|-------------|
| `browser_click` | Click via element reference handle (`e1`), CSS selector, or text selector |
| `browser_fill` | Fill input fields via element ref (`e1`) or CSS selector (CSP-strict SPA support) |
| `browser_press_key` | Keyboard events (Enter, Tab, Escape, modifiers) |
| `browser_scroll` | Scroll to element or by pixels |
| `browser_wait` | Wait for element to appear |
| `browser_hover` | Hover for tooltips/dropdowns (supports element refs) |
| `browser_select_option` | Native `<select>` + custom dropdowns (Angular Material, React Select) |
| `browser_set_combobox` | Autocomplete/combobox: type query → wait for filtered listbox → click option (multi-value chip support) |
| `browser_set_date` | Robust date inputs: tries native value-set → masked typing → calendar-picker navigation |
| `browser_dismiss_overlays` | Bulk-dismiss popups/modals/tooltips/banners via aria-label/text/×-char heuristics |
| `browser_handle_dialog` | Accept/dismiss native alert/confirm/prompt dialogs |
| `browser_double_click` | True double-click (two trusted press/release pairs) |
| `browser_right_click` | Right-click to open page-level context menus |
| `browser_click_xy` | Escape hatch: click at raw viewport coordinates (CSS pixels) with trusted mouse events |
| `browser_reattach_debugger` | Recovery: force-detach and re-attach the Chrome debugger on the current tab |

### Tabs & Frames
| Tool | Description |
|------|-------------|
| `browser_list_tabs` | List session's tabs only |
| `browser_switch_tab` | Switch to tab by ID |
| `browser_close_tab` | Close tab (session-owned only) |
| `browser_get_new_tab` | Get most recently opened tab (OAuth popups) |
| `browser_list_frames` | List iframes on page |
| `browser_select_frame` | Execute JS in specific iframe |

### Data & Network
| Tool | Description |
|------|-------------|
| `browser_fetch` | HTTP request from extension (bypasses CORS) |
| `browser_wait_for_network` | Wait for specific API call to complete |
| `browser_extract_token` | Navigate to provider dashboard + extract API token |

### CAPTCHA Solving
| Tool | Description |
|------|-------------|
| `browser_solve_captcha` | Detect and solve CAPTCHAs. Auto-detects reCAPTCHA v2/v3, hCaptcha, Turnstile, FunCaptcha |

### Human-in-the-Loop
| Tool | Description |
|------|-------------|
| `browser_ask_user` | Show overlay dialog for 2FA, CAPTCHA, credentials, or any user input |

### Storage & Files
| Tool | Description |
|------|-------------|
| `browser_get_cookies` | Get cookies for a site this session has open |
| `browser_set_cookies` | Set cookies for a domain |
| `browser_get_local_storage` | Read localStorage from page |
| `browser_set_local_storage` | Write localStorage values |
| `browser_console_logs` | Capture console.log/warn/error messages from page |
| `browser_upload_file` | Upload files to `<input type="file">` via Chrome Debugger API (no dialog) |
| `browser_drop_file` | Upload via drop-zones: finds hidden `<input type="file">` in target subtree |

### Diagnostics & Feedback
| Tool | Description |
|------|-------------|
| `browser_provide_feedback` | Self-check + report in one call. Verifies versions, detects conflicts, and generates diagnostic reports |
| `browser_about` | Project info + pre-filled links to submit a wish, use-case, or bug |

---

## 🛡️ Rigorous Quality Gates & Verification

Browser MCP enforces strict continuous integration gates modeled after industry standards:
- **86 Automated Test Suites**: 100% passing across all 781 subtests.
- **Syntax & Packaging Integrity**: Validates extension syntax and enforces byte-for-byte distribution parity (`npm run build`).
- **Rust Compile Gate**: Verified warning-free on Rust 1.80+ using `cargo check` and `cargo test`.

---

## 📄 License & Attribution

- **Author**: **Mohamed Elsheikh** ([@modded-soldier-9](https://github.com/modded-soldier-9))
- **Email**: `moddedsoldier@gmail.com`
- **License**: [MIT License](LICENSE)
