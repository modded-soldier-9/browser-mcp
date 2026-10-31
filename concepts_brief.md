# Standalone Rust Browser MCP Architecture & Modernization

* **Author:** Mohamed Elsheikh (@modded-soldier-9)
* **Date:** 2026-10-31

## Overview

Browser MCP is being re-architected into an independent, 100% English, single-binary Rust automation bridge designed for modern AI coding assistants (Claude Code, Cursor, Antigravity, OpenCode, Codex). The server connects AI agents directly to live, authenticated browser profiles in Chrome and Brave via a low-restriction Manifest V2 extension, bypassing cloud bot-detection walls, Cloudflare challenges, and SSO login boundaries.

This modernization transitions the project from a hybrid Node.js/Rust fork into an owned, standalone system. It eliminates the 50 MB Node.js runtime in favor of a sub-4ms compiled binary (<4 MB RAM), embeds the extension bundle directly inside the executable for zero-dependency self-installation, purges all legacy Danish technical debt, hardens WebSocket security boundaries, and establishes cross-platform distribution through automated GitHub Releases.

## Analysis

### 1. Contrarian / YAGNI & Code Minimization
- **Dual-Runtime Elimination**: Maintaining both Node.js (`mcp-server/index.js`) and Rust (`crates/browser-mcp-server`) doubles bug surface area and introduces version drift. Decommissioning the Node runtime completely eliminates `node_modules` supply-chain vulnerabilities, npm deprecation warnings, and runtime dependencies.
- **Tool Surface Rationalization**: The current 40-tool specification totals 941 lines of JSON schema and consumes approximately 9,000 tokens on every LLM turn. Redundant mouse interaction primitives (`browser_click_xy`, `browser_double_click`, `browser_right_click`) can be dispatched via `browser_click` with optional arguments, and Danish parameter keys (`eget_vindue`, `fokuser`, `vindue_x`, `vindue_bredde`, `vindue_hoejde`) must be renamed to standard English (`new_window`, `focus`, `x`, `width`, `height`).
- **Rust Dependency Trim**: The Rust server currently pulls `sysinfo` to scan all OS processes every 5 seconds just to check parent process liveness. Stdio pipe EOF handling in `main.rs` detects parent termination without process polling or external crates. Derive-heavy CLI crates (`clap`) can be replaced with standard library arguments (`std::env::args()`), and `regex` can be replaced with direct URL prefix matching.

### 2. System Architecture & Security Boundaries
- **Localhost WebSocket Authentication**: The WebSocket bridge on ports 9876–9895 currently accepts any connection matching `^chrome-extension://[a-p]{32}$` without secret negotiation. Any rogue extension or malicious local process could connect to the open port and harvest authenticated cookies (`browser_get_cookies`) or session tokens. The Rust server must generate a cryptographic handshake token at startup and require it during WebSocket initialization.
- **Stdio Transport Starvation**: The Rust binary currently reads stdio requests synchronously. During long-running tool invocations (such as `browser_ask_user` waiting 120s for human 2FA or `browser_extract_list` scrolling large feeds), the stdio loop is blocked. Incoming MCP `ping` requests are starved, causing Claude Code and Cursor to terminate the bridge process. Stdio request ingestion must be decoupled from tool execution using Tokio asynchronous worker tasks, with immediate `ping` response handling.
- **Watchdog Self-Monitoring Bug**: In `crates/browser-mcp-server/src/main.rs:63`, the server assigns its own PID (`std::process::id()`) to the parent watchdog, and the shutdown channel receiver is unpolled. If the host assistant crashes, orphaned Rust processes remain alive indefinitely, holding TCP ports and exhausting the 20-port pool.

### 3. UX, Developer Ergonomics & Real Workflows
- **Target Workflows**: AI assistants conducting development workflows require inspecting local services (`http://localhost:3000`), diagnosing DevTools console logs, interacting with authenticated SaaS portals (AWS Management Console, GitHub PRs, Vercel dashboards) without triggering bot blocks, and completing 2FA / CAPTCHA challenges via human-in-the-loop modal dialogs (`browser_ask_user`).
- **Zero-Dependency Installer**: The Rust binary currently has a stubbed `--install` flag. With Node.js removed, users cannot rely on `npx browser-mcp install`. The Rust binary must embed the `extension/` directory at compile time using `include_dir!` and implement `browser-mcp install`, which extracts the extension to `~/.browser-mcp/extension/` and automatically registers the server into detected client configurations (`~/.gemini/config/mcp_config.json`, `~/.cursor/mcp.json`, `~/.config/opencode/opencode.json`, `claude mcp add`).
- **Safety & Profile Separation**: Running automations directly in the user's primary browser profile presents risks of accidental data mutation. The system must support dedicated development profiles (`--profile-dir`) and domain allowlisting.

### 4. Manifest V2 vs. V3 Longevity Strategy
- Retaining Manifest V2 is necessary to maintain persistent background workers and avoid Manifest V3's 30-second idle service worker termination. Because Chrome Stable is phasing out consumer MV2 support, Brave is positioned as the primary recommended browser tier.
- To future-proof the codebase against eventual Chromium-wide MV2 deprecation, background extension logic must be abstracted behind a modular event adapter, enabling a clean future migration to MV3 with Offscreen Documents or Native Messaging without altering tool logic.

### 5. Technical Debt & Danish Legacy Inventory
All legacy Danish identifiers, comments, scripts, and directories must be systematically purged:
- **Directories**: Rename `maaling/` to `benchmarks/`; delete `test/aerlighed/` and `test/hjaelp/`.
- **Scripts**: Purge or rewrite `runbrowsermcpupdate.sh`, `scripts/flow-daekning.sh`, `scripts/konkurrent-vagt.py`, `scripts/npm-oidc-tjek.py`, `scripts/beviskort.sh`, `scripts/byg-mcpb.sh`.
- **Code Identifiers**: Remove `vagt.js` (`ledErDoedt`, `forfaedreKaede`), `alleePorteOptaget`, `loesPortLoefte`, `sikrePort`, `forklarSkaevhed`, `armeredeDialoger`, `evaluerTaalmodigt`, `iLuften`, `harServer`.

## Goals vs. Non-Goals

* **In-Scope Goals:**
  - Build a standalone native Rust binary (`browser-mcp`) as the sole server runtime, compiling for Windows (`x86_64`), macOS (`x86_64`, `aarch64`), and Linux (`x86_64`, `aarch64`).
  - Embed the MV2 Chrome extension assets inside the compiled binary and implement an automated `browser-mcp install` command.
  - Implement loopback WebSocket authentication via a pre-shared handshake token.
  - Fix stdio starvation by handling MCP `ping` asynchronously and offloading tool execution to Tokio tasks.
  - Replace the flawed watchdog check with stdio EOF detection and true parent PID ancestry tracking.
  - Purge 100% of Danish files, variables, comments, and external domain references, standardizing exclusively on English.
  - Automate binary builds and multi-platform archive creation via GitHub Actions releases.

* **Out-of-Scope Non-Goals:**
  - Full rewrite of the Chrome extension in WebAssembly/Rust (extension remains pure vanilla JavaScript for simplicity and zero build step).
  - Headless browser emulation (Browser MCP is explicitly designed for live, authenticated browser sessions; headless testing belongs to Playwright/Puppeteer).
  - Complex in-binary self-updating daemons (updates handled through package managers or GitHub release binary replacement).
  - Removing JavaScript dev tooling entirely (lightweight scripts for linting or extension packaging remain acceptable in development).

## Alternatives Weighed

1. **Dual-Engine (Node.js npm package + Optional Rust binary)**:
   - *Rejected*: Maintaining two parallel server implementations requires maintaining duplicate schemas, duplicate bug fixes, and dual CI pipelines. It defeats the goal of creating a fast, minimal, owned project.
2. **Immediate Migration to Manifest V3**:
   - *Rejected*: MV3 service workers terminate after 30 seconds of inactivity, which terminates active WebSocket connections to the MCP host and drops session state during agent thinking pauses. MV2 remains significantly more reliable for persistent agent sessions.
3. **Native Messaging Host instead of WebSocket**:
   - *Rejected*: Chrome Native Messaging requires OS-level registry entries and JSON framing per message, complicating multi-session tab isolation and multi-client connections. WebSockets over loopback provide greater flexibility across multiple concurrent agent sessions.
4. **Keeping `sysinfo` Polling for Watchdog**:
   - *Rejected*: Polling the entire operating system process table every 5 seconds wastes CPU and battery. Stdio EOF detection reliably indicates parent process death without scanning foreign processes.

## Key Decisions & Staging for Next Steps

1. **Canonical Binary Name**: Consolidate the package and crate name into `browser-mcp` (output binary `browser-mcp` / `browser-mcp.exe`).
2. **Asset Embedding**: Use `include_dir` to bundle `extension/` inside the binary for seamless zero-dependency deployment via `browser-mcp install`.
3. **Execution Roadmap**:
   - **Phase 1**: Harden Rust engine (`crates/browser-mcp-server`), resolve watchdog bug, add WebSocket auth token, and implement `install` CLI.
   - **Phase 2**: Decommission `mcp-server/` directory, purge Danish scripts, and rename `maaling/` to `benchmarks/`.
   - **Phase 3**: Establish GitHub Actions CI/CD release workflow for cross-platform archive generation.
   - **Phase 4**: Implement native Rust integration test suite (`tests/bridge_test.rs`).
   - **Phase 5**: Update all documentation, root blueprint, and publish `v2.1.0` standalone GitHub release.
