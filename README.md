# Browser MCP (v2.0.0)

**The rock-solid browser automation MCP connecting AI agents directly to your real browser session.** A 2FA code, a CAPTCHA, a choice only you can make: it asks on your own screen, then carries on seamlessly in the tab you were already signed into.

Browser MCP is built for connection resilience, headless silent execution, and modern developer workflows. Up to 20 agents at once, each in its own color-coded tab group. 40 tools, MIT, runs entirely on your machine.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)
[![Version](https://img.shields.io/badge/version-2.0.0-emerald)](https://github.com/Agent360dk/browser-mcp)

[![Browser MCP Demo](https://raw.githubusercontent.com/Agent360dk/browser-mcp/main/assets/demo.gif)](https://browsermcp.dev)

---

## ⚡ What's New in v2.0.0

- 🚀 **Immediate Startup Port Binding**: Port 9876-9895 binds immediately on process start, allowing the extension bridge to connect instantly without waiting for the first tool invocation.
- 💓 **Dual-Layer Heartbeat Protocol**: 12-second WebSocket ping-pong and 20-second Service Worker keepalive alarms keep Manifest V3 workers alive and eliminate random disconnects.
- 🎨 **Obsidian Glass Popup UI**: Designed around Apple & Emil Kowalski interaction foundations: dark translucent glassmorphism, pulsing live status dots, real-time `chrome.storage` reactivity, and one-click CLI setup copying.
- 🤫 **Silent Headless Execution**: Zero terminal clutter. Spawns silently in the background over stdio via OpenCode, Claude Code, Cursor, and VS Code. No persistent CMD window tabs required.
- 🛡️ **Brave & Chrome Compatibility**: Tested and verified across Brave Browser (`brave://extensions`) and Google Chrome (`chrome://extensions`).

---

## Quick Setup (3 Steps)

### 1. Install & Link Package
From the repository root or via npm:
```bash
cd mcp-server
npm install -g .
```
*(Or install globally: `npm install -g browser-mcp`)*

### 2. Load Extension in Brave or Chrome
1. Open your browser and navigate to `brave://extensions` (or `chrome://extensions`).
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** (top-left).
4. Select the extension directory:
   - Windows: `%USERPROFILE%\.browser-mcp\extension\` (or `<workspace>\browser-mcp\extension`)
   - Mac / Linux: `~/.browser-mcp/extension/`

### 3. Configure Your AI Client

#### OpenCode
In `~/.config/opencode/opencode.json`:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "browser-mcp": {
      "type": "local",
      "command": ["browser-mcp"],
      "enabled": true
    }
  }
}
```
*(Running `npx browser-mcp install` automatically configures this for you!)*

#### Claude Code
```bash
claude mcp add --scope user browser-mcp -- browser-mcp
```

#### Cursor
In `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "browser-mcp",
      "args": []
    }
  }
}
```

#### VS Code
In your VS Code `settings.json` or MCP configuration:
```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "browser-mcp",
      "args": []
    }
  }
}
```

---

## Testing the Connection

Once registered, ask your AI agent:
> *"Take a screenshot of my current browser tab."*

The extension popup will display a glowing green dot (**Connected · Port 9876**) and your agent will return an image of your active tab.

---

## 40 Tools

### Navigation & Content
| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to URL (reuses tab, or `new_tab=true`) |
| `browser_get_page_content` | Get page text or HTML |
| `browser_screenshot` | Screenshot via Chrome Debugger (works even when tab isn't focused) |
| `browser_execute_script` | Run JavaScript in page context |
| `browser_extract_list` | Read every row of a long/virtualised list by scrolling its container until no new rows appear |

### Interaction
| Tool | Description |
|------|-------------|
| `browser_click` | Click via CSS or text selector (`text=Submit`, `button:text(Next)`) |
| `browser_fill` | Fill input fields (works on CSP-strict sites) |
| `browser_press_key` | Keyboard events (Enter, Tab, Escape, modifiers) |
| `browser_scroll` | Scroll to element or by pixels |
| `browser_wait` | Wait for element to appear |
| `browser_hover` | Hover for tooltips/dropdowns |
| `browser_select_option` | Native `<select>` + custom dropdowns (Angular Material, React Select) |
| `browser_set_combobox` | Autocomplete/combobox: type query → wait for filtered listbox → click option (multi-value chip support). Use when `browser_select_option` fails on lazy-rendered options |
| `browser_set_date` | Robust date inputs: tries native value-set → masked typing → calendar-picker navigation (MUI/AntD/react-datepicker/Lexical). Use when `browser_fill` fails on date fields |
| `browser_dismiss_overlays` | Bulk-dismiss popups/modals/tooltips/banners via aria-label/text/×-char heuristics. `non_critical` mode preserves dialogs with form data |
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
| `browser_solve_captcha` | Detect and solve CAPTCHAs. Auto-detects reCAPTCHA v2/v3, hCaptcha, Turnstile, FunCaptcha. Actions: `detect`, `click_checkbox` (auto-click, often passes when signed into Google), `click_grid` (AI vision guided), `ask_human` (fallback) |

### Human-in-the-Loop
| Tool | Description |
|------|-------------|
| `browser_ask_user` | Show overlay dialog for 2FA, CAPTCHA, credentials, or any user input |

### Data
| Tool | Description |
|------|-------------|
| `browser_get_cookies` | Get cookies for a site this session has open |
| `browser_set_cookies` | Set cookies for a domain |
| `browser_get_local_storage` | Read localStorage from page |
| `browser_set_local_storage` | Write localStorage values |
| `browser_console_logs` | Capture console.log/warn/error messages from page |
| `browser_upload_file` | Upload files to `<input type="file">` via Chrome Debugger API (no dialog) |
| `browser_drop_file` | Upload via drop-zones: finds hidden `<input type="file">` in target subtree/parent (up to 2 levels). Use when `browser_upload_file` fails because the zone has no visible input |

### Diagnostics & feedback
| Tool | Description |
|------|-------------|
| `browser_provide_feedback` | Self-check + report in one call. Compares this server against the latest on npm, the connected extension against this server, and detects **more than one Browser MCP extension connected at once** - the three things that explain most "it just stopped working" moments. Returns a verdict (`current` / `outdated` / `conflict` / `disconnected`), concrete fix steps, and a pre-filled issue link for whatever is genuinely missing. Your agent calls it on its own whenever a tool blocks it |
| `browser_about` | Project info + pre-filled links to submit a wish, use-case, or bug |

---

## Multi-Session Support

Each conversation gets its own MCP server on a unique port (9876-9895). The browser extension connects to all active servers simultaneously.

```
AI Agent Session 1 ←(stdio)→ MCP :9876 ←(WS)→
AI Agent Session 2 ←(stdio)→ MCP :9877 ←(WS)→  Extension → Real Browser
AI Agent Session 3 ←(stdio)→ MCP :9878 ←(WS)→
```

- **Session isolation** - each session gets a color-coded Chrome/Brave Tab Group
- **Tab ownership** - sessions can only see and control their own tabs
- **Auto-cleanup** - processes exit when the AI client closes the conversation
- **Immediate Port Binding** - binds port on launch for instant readiness, releases cleanly on exit

---

## Architecture

```
extension/
  manifest.json       # Manifest V3
  background.js       # Service worker - Chrome API dispatcher, session tab groups
  offscreen.js        # Persistent WebSocket bridge (heartbeat & multi-port scanning)
  popup.html/js       # Emil Kowalski obsidian glass status UI

mcp-server/
  index.js            # MCP server (stdio) + WebSocket client
  tools.js            # 40 tool definitions
  bin/cli.js          # Multi-client auto-registration CLI
```

---

## Privacy & Security

- **Direct Local Communication**: All traffic between the AI agent, the MCP server, and the browser extension occurs strictly on `127.0.0.1` via stdio and local WebSockets.
- **Zero External Telemetry**: No third-party servers, tracking, telemetry, or remote telemetry endpoints.
- **Human-in-the-Loop Safeguards**: Sensitive actions (passwords, 2FA codes, payment authorization) can trigger `browser_ask_user` so you always retain full control.

---

## License

MIT License.
