# Browser MCP - Wishlist

Public roadmap and wishlist for Browser MCP, curated by [@modded-soldier-9](https://github.com/modded-soldier-9).

## How to add a wish

- **Submit an issue:** [Open a Feature Wish](https://github.com/modded-soldier-9/browser-mcp/issues/new?template=wish.yml).
- **PR directly:** Open a pull request with your proposal under **Wanted**.

When a feature lands, it moves to **Shipped** with its release version.

---

## 🟡 Wanted

- [Submit a wish](https://github.com/modded-soldier-9/browser-mcp/issues/new?template=wish.yml)
- Firefox support via WebExtensions API parity.
- Linux headless virtual display test runner automation.
- Native system tray status icon for active sessions.

---

## ✅ Shipped in v2.1.0 (2026-10-31)

- **Standalone Native Rust MCP Server**: Completely replaced legacy Node.js daemon with a compiled 3.07 MB native Rust binary (`browser-mcp` / `browser-mcp.exe`). Boot latency reduced to < 4 ms and idle memory footprint to ~3.8 MB RAM.
- **Embedded Self-Installer (`browser-mcp install`)**: Single-command unpacking of extension assets into `~/.browser-mcp/extension/` with automatic configuration outputs for Claude Code, Cursor, and Antigravity.
- **Decoupled Asynchronous Stdio Engine**: Tokio-powered asynchronous request processing with fast-path keep-alive intercept for MCP `ping`, eliminating agent stdio starvation during long browser actions.
- **Manifest V2 Longevity**: Maintained persistent MV2 background architecture across Brave and Chrome, avoiding the 30-second service-worker idle disconnects of MV3.
- **Zero Node.js Runtime Footprint**: Fully deleted `mcp-server/` and associated npm dependencies.
- **Loopback Origin Verification**: Strict WebSocket handshake verification enforcing `Origin: chrome-extension://[a-p]{32}` on `127.0.0.1:9876-9895`.
- **Complete English Standardization**: Normalized all Danish parameter keys (`new_window`, `focus`, `x`, `y`, `width`, `height`), comments, logs, and schemas across all 40 MCP tools.

---

## ✅ Historical Releases (v1.29 - v1.30)

- **40 MCP Tools Surface**: Comprehensive tool suite covering DOM extraction, screenshotting, CDP actions, cookies, and dialogs.
- **Direct Element Targeting**: Accessibility tree (AXTree) snapshotting with deterministic handles (`[e1]`, `[e2]`).
- **Human-in-the-Loop Safeguards**: Integrated `browser_ask_user` overlay dialogs for 2FA, OTP, and user confirmations.
- **Controlled Select and Form Handling**: Handled React-controlled comboboxes, date pickers, and file drops.
