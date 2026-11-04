# Changelog

All notable changes to Browser MCP are documented here.
Releases and pre-compiled binaries are published on the [GitHub Releases page](https://github.com/modded-soldier-9/browser-mcp/releases).

Browser MCP is authored and maintained by Mohamed Elsheikh ([@modded-soldier-9](https://github.com/modded-soldier-9)).

## 1.0.0 (2026-11-02)

**Grand Initial Release of Browser MCP — Native Rust AI Browser Automation Bridge.**

Browser MCP connects AI coding assistants (Claude Code, Cursor, Codex, Antigravity) directly to live, already-logged-in Brave and Chrome browser sessions with zero cloud dependencies and sub-4ms execution.

### Key Highlights

- **Standalone Native Rust Server**: High-performance, zero-dependency native Rust binary (`browser-mcp` / `browser-mcp.exe`). Boots in sub-4ms, idles at ~3.8MB RAM, and communicates via asynchronous stdio JSON-RPC coupled with a loopback WebSocket bridge on `127.0.0.1:9876-9895`.
- **43 Browser Automation Tools**: Comprehensive automation tool surface featuring authentic hardware event dispatch (`isTrusted: true`) via Chrome DevTools Protocol (CDP), bypassing bot detection and enabling interaction with complex Canvas, WebGL, and SVG interfaces.
- **Context Shield Subsystem**: Autonomous token protection engine. Payloads exceeding 2,500 tokens automatically spool full representations to `~/.browser-mcp/snapshots/` while returning concise in-band references with line-based pagination (`page_offset`, `limit`), managed by an LRU disk cache (50MB / 50 files).
- **State Delta Engine (`format="delta"`)**: High-efficiency DOM mutation stream emitting only added and removed interactive elements after actions, reducing multi-turn token consumption by ~85%.
- **Spatial Viewport Pruning (`viewport_only=true`)**: Filters extracted DOM nodes to elements visible in the active viewport window (`rect.bottom >= 0 && rect.top <= window.innerHeight`), cutting tokens by 50–70% on infinite-scroll interfaces while preserving stable monotonic handles. Returns full `{ in_viewport, offscreen_below, scroll_y, max_scroll_y }` geometry telemetry.
- **Atomic Form Batching (`browser_fill`)**: Multi-field form submission batching with `fields: [{ selector, value }]` executed in a single atomic turn with 35ms event-loop pacing, replacing multiple round-trips with instant execution.
- **Failed Network Inspector (`browser_get_failed_requests`)**: Dedicated diagnostics tool capturing 4xx/5xx HTTP errors, failed fetches, and blocked resources with automatic authorization header and secret token redaction.
- **Compositor Overlays (`browser_highlight`)**: Hardware-accelerated visual feedback utilizing CDP `Overlay.highlightQuad` with custom RGBA fill and border colors, with optional auto-dismiss timers.
- **Semantic Element Search (`browser_search_elements`)**: Fast, token-efficient fuzzy search targeting actionable controls by accessible name, role, or text in sub-100 tokens, maintaining persistent handles (`[e1]`, `[e2]`) anchored via `WeakMap`.
- **Human-in-the-Loop Safeguards (`browser_ask_user`, `browser_solve_captcha`)**: Interactive browser overlay dialogs prompting users for 2FA verification, OTPs, or human CAPTCHA solving, pausing automation until user confirmation is received.
