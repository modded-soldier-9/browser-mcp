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

## ✅ Shipped in v1.0.0 (2026-11-02)

- **Standalone Native Rust MCP Server**: Completely replaced legacy Node.js daemon with a compiled native Rust binary (`browser-mcp` / `browser-mcp.exe`). Boot latency reduced to < 4 ms and idle memory footprint to ~3.8 MB RAM.
- **Context Shield Subsystem**: Autonomous token protection engine with snapshot spooling to disk (`~/.browser-mcp/snapshots/`), in-band pagination, and LRU cache.
- **State Delta Engine (`format="delta"`)**: Fast DOM diffing stream reducing multi-turn token overhead by ~85%.
- **Spatial Viewport Pruning (`viewport_only=true`)**: Viewport filtering pruning off-screen elements to save 50-70% tokens on long feeds while retaining monotonic element handles.
- **Atomic Form Batching (`browser_fill`)**: Multi-field form submission executing in a single atomic turn with 35ms event-loop pacing.
- **43 Native Browser Tools Surface**: Comprehensive tool suite covering DOM extraction, screenshotting, hardware CDP actions, cookies, dialogs, compositor overlays, and failed request inspection.
- **Direct Element Targeting**: Accessibility tree (AXTree) snapshotting with deterministic handles (`[e1]`, `[e2]`) anchored via WeakMap.
- **Human-in-the-Loop Safeguards**: Integrated `browser_ask_user` and `browser_solve_captcha` overlay dialogs for 2FA, OTP, and user confirmations.
- **Embedded Self-Installer (`browser-mcp install`)**: Single-command unpacking of extension assets into `~/.browser-mcp/extension/` with automatic configuration outputs for Claude Code, Cursor, and Antigravity.
- **Decoupled Asynchronous Stdio Engine**: Tokio-powered asynchronous request processing with fast-path keep-alive intercept for MCP `ping`, eliminating agent stdio starvation during long browser actions.
- **Manifest V2 Longevity**: Maintained persistent MV2 background architecture across Brave and Chrome, avoiding the 30-second service-worker idle disconnects of MV3.
- **Loopback Origin Verification**: Strict WebSocket handshake verification enforcing `Origin: chrome-extension://[a-p]{32}` on `127.0.0.1:9876-9895`.
