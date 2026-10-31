# Initial Zoom Out Review Report

*   **Target File**: `docs/designs/standalone-rust-browser-mcp.md`
*   **Active Scope**: Lines 1..394 (Full Document)
*   **Reviewer**: Skeptical Architect (`egm-zoom-out`)
*   **Standard Applied**: `zoom-out-standard.md`

--------------------------------------------------------------------------------

## High-Altitude Evaluation

The proposal successfully identifies the core root problem: eliminating the heavy dual-runtime Node.js dependency in favor of a native, compiled Rust executable. It correctly targets the severe self-PID watchdog bug in `main.rs:63` and addresses stdio line-read starvation. However, the design suffers from two critical architectural dead-ends and speculative complexity that must be pruned.

--------------------------------------------------------------------------------

## Findings

### Finding 1: Sandboxed Extension File-Token Dead-End
*   **Severity**: 🔴 Blocker
*   **Affected Scope**: Lines 42–46, 123–131, 275–282
*   **Simplicity Rationale**: The document mandates that the server generate a session token in `~/.browser-mcp/session.token` and reject connections without it. Sandboxed Chromium extensions have zero filesystem access to read host files. Leaving Open Question 1 open while marking the document "Approved" repeats past rollback mistakes.
*   **Recommendation**: Bind exclusively to `127.0.0.1`, enforce `Origin: chrome-extension://[a-p]{32}`, and drop dynamic file tokens until a proper native messaging or pairing channel exists.

### Finding 2: Conflating `browser_extract_token` with Internal Auth
*   **Severity**: 🔴 Blocker
*   **Affected Scope**: Lines 21–22, 132–138, 283–291
*   **Simplicity Rationale**: The design misclassifies `browser_extract_token` as an internal server token helper to be handled locally in Rust. In `tools_schema.json`, `browser_extract_token` is an automation tool that takes `provider: string` and navigates the browser to external SaaS dashboards (Stripe, GitHub, Slack) to capture API keys. Rewriting it to read local server tokens breaks the public schema contract.
*   **Recommendation**: Keep `browser_extract_token` routed to the browser extension; restrict server-local execution strictly to `browser_about` and `browser_provide_feedback`.

### Finding 3: Redundant Parent PID Polling & `sysinfo` Dependency
*   **Severity**: 🟡 Major
*   **Affected Scope**: Lines 139–144, 199–206, 308–315
*   **Simplicity Rationale**: The 5-second parent PID polling loop was a legacy workaround for multi-hop npm wrappers (`Claude -> wrapper -> npm -> node`). For a standalone native executable, standard Tokio stdin EOF (`read_line() == Ok(0)`) detects host termination immediately with 0% CPU churn and zero dependencies.
*   **Recommendation**: Remove the periodic parent PID polling loop and `sysinfo` dependency; terminate directly on Tokio stdin EOF or OS termination signals.

### Finding 4: Multi-Editor Configuration Auto-Mutation Fragility
*   **Severity**: 🟡 Major
*   **Affected Scope**: Lines 52–53, 145–156, 302–306
*   **Simplicity Rationale**: Attempting to parse, edit, and write configuration files for four different editors (Cursor, Claude Code, Antigravity, OpenCode) across different platforms creates lock contention and syntax corruption risks.
*   **Recommendation**: Scope `browser-mcp install` to extracting extension files to `~/.browser-mcp/extension/` and outputting verified configuration snippets and CLI commands (`claude mcp add browser-mcp ...`).

### Finding 5: Altitude Drops (Weeds in High-Level Sections)
*   **Severity**: 🟢 Nit
*   **Affected Scope**: Lines 157–165, 250–258, 271–274
*   **Simplicity Rationale**: High-level architectural sections prematurely delve into compiler optimization flags (`opt-level = 3`, `lto = true`), JSON-RPC error codes (`-32602`), and exhaustive parameter translation tables.
*   **Recommendation**: Move compiler flags and parameter lookup tables into implementation checklists.
