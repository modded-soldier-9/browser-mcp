# Comprehension Review Report

*   **Target File**: `docs/designs/standalone-rust-browser-mcp.md`
*   **FeatureRange**: Lines 1..245
*   **DetailedRange**: Lines 246..394
*   **Reviewer**: Comprehension Goldfish (`egm-comprehension`)

--------------------------------------------------------------------------------

## What this proposes

This document proposes modernizing `browser-mcp` into a single standalone native Rust executable (`browser-mcp`), decommissioning the legacy Node.js server implementation and purging Danish technical debt across the repository. The native binary embeds Manifest V2 browser extension assets directly for zero-dependency automated configuration across supported AI coding assistants (Claude Code, Cursor, Antigravity, OpenCode). It introduces a decoupled asynchronous Tokio stdio loop to guarantee immediate responses to MCP `ping` keep-alives during long-running tool executions, fixes process lifecycle management to shut down upon parent exit or stdin pipe closure, and secures loopback WebSocket communications with pre-shared cryptographic tokens.

## How the existing system works, per this document

Per this document, Browser MCP currently maintains a dual-runtime split between a legacy Node.js server (`mcp-server/index.js`) and an incomplete Rust server (`crates/browser-mcp-server`), duplicating tool definitions and requiring a 50+ MB Node.js runtime. The current Rust server suffers from a broken watchdog that monitors its own PID instead of its parent's, leaving orphaned processes holding ports in the 9876–9895 range, and uses synchronous stdio reads that block the entire runtime loop during slow tools. Browser automation commands are relayed over an unauthenticated loopback WebSocket server to a persistent Manifest V2 Chrome/Brave extension, but server-local commands (`browser_about`, `browser_provide_feedback`, `browser_extract_token`) fail because they are erroneously forwarded to the browser extension. Finally, the codebase contains widespread Danish naming conventions, scripts, and comments, and the native binary lacks functional self-installation.

--------------------------------------------------------------------------------

## Findings

### Finding 1: Unresolved Token Delivery Mechanism Across the Browser Sandbox Boundary
*   **Severity**: 🔴 Blocker
*   **Affected Scope**: Section "Open Questions" (lines 43–44), Section "Technical Plan: 2. Loopback WebSocket Bridge with Token Authentication" (lines 126–129), Section "Detailed Implementation Plan: 11. extension/background.js" (line 334).
*   **Discrepancy Description & Rationale**: The document presents a critical architectural contradiction regarding how the extension obtains the pre-shared authentication token. Open Question 1 lists token discovery as an unsolved question. However, later sections describe contradictory and technically impossible mechanisms: line 127 states the token is saved to `~/.browser-mcp/session.token` on the host filesystem, while line 334 states `background.js` reads the token from "query parameter or local storage". A sandboxed Chromium WebExtension cannot access host filesystem paths like `~/.browser-mcp/`, and external native processes cannot write directly into `chrome.storage.local` without an existing communication channel. Furthermore, line 129 specifies that any WebSocket handshake lacking a valid token is terminated immediately, which rules out an unauthenticated initial probe. A fresh reader cannot determine how the extension bridges the browser boundary to acquire the handshake token.

### Finding 2: Unclear Purpose, Scope, and Security Model of `browser_extract_token`
*   **Severity**: 🟡 Major
*   **Affected Scope**: Section "The Problem" (line 21), Section "Technical Plan: 3. Local vs. Remote Tool Dispatcher" (line 136), Section "Detailed Implementation Plan: 5. crates/browser-mcp-server/src/tools.rs" (line 288).
*   **Discrepancy Description & Rationale**: The document identifies `browser_extract_token` as a tool previously misrouted to the extension that must now be handled locally in Rust by extracting session tokens from "disk cache or environment variables". To a new engineer, this explanation is ambiguous: Is this tool an MCP tool exposed to AI assistant models? If so, does it return the server's own loopback WebSocket handshake token (which would expose the security boundary over MCP), or does it extract user web authentication tokens/cookies? The document lacks a clear definition of what token this tool extracts, what callers use it, and what its security boundaries are.

### Finding 3: Broken Tool Response Flow in Architectural Mermaid Diagram
*   **Severity**: 🟡 Major
*   **Affected Scope**: Section "Architectural Overview" (lines 74–111).
*   **Discrepancy Description & Rationale**: In the architecture diagram, message dispatch routes from `STDIN` -> `ROUTER` -> `TASK_POOL`, and `TASK_POOL` communicates bidirectionally with `WS_BRIDGE`. While fast-path `PING` and `LOCAL_TOOLS` have direct arrows outputting to `STDOUT`, there is no return arrow or path showing how tool execution results from `WS_BRIDGE` or `TASK_POOL` flow back to `STDOUT`. A reader following the sequence sees remote browser command responses dead-end in `TASK_POOL`.

### Finding 4: Omission of macOS Support and Mechanism for Parent PID Liveness Checks
*   **Severity**: 🟡 Major
*   **Affected Scope**: Section "Technical Plan: 4. Parent Process Watchdog & Self-Termination" (lines 143–144), Section "Detailed Implementation Plan: 1. Cargo.toml" (line 256), Section "Detailed Implementation Plan: 8. watchdog.rs" (lines 311–314).
*   **Discrepancy Description & Rationale**: Line 143 explicitly limits parent PID tracking to Windows and Linux, omitting macOS (Darwin) entirely despite macOS being a tier-1 release target. In addition, line 256 proposes removing `sysinfo` to reduce binary size, but the document does not specify what OS system calls or APIs will replace it across supported operating systems.

### Finding 5: Inconsistent CLI Invocation Contract (`install` vs. `--install`)
*   **Severity**: 🟡 Major
*   **Affected Scope**: Section "The Problem" (line 23), Section "Critical User Journeys" (line 51), Section "Technical Plan: 5. Embedded Assets & Self-Installer" (line 147), Section "Detailed Implementation Plan: 2. main.rs" (line 264), Section "Verification Plan" (line 381).
*   **Discrepancy Description & Rationale**: The document mixes command-line interfaces between a flag and a subcommand. Lines 23 and 264 refer to replacing the stubbed `--install` flag, whereas lines 51, 147, and 381 specify the command as a subcommand: `browser-mcp install`. The design should standardize explicitly on `browser-mcp install`.

### Finding 6: Ambiguous Parameter Translation Direction in `tools.rs`
*   **Severity**: 🟡 Major
*   **Affected Scope**: Section "Technical Plan: 6. Tool Schema Standardization" (lines 158–164), Section "Detailed Implementation Plan: 5. tools.rs" (line 290).
*   **Discrepancy Description & Rationale**: Section 6 states that all Danish parameter names in `tools_schema.json` are being renamed to standard English (`eget_vindue` -> `new_window`). Line 290 then notes that `tools.rs` will "Translate Danish parameter mapping in dispatch handlers (`eget_vindue` -> `new_window`, etc.)". If the client-facing schema is in English, and line 333 purges Danish identifiers in the extension, it is unclear why `tools.rs` is translating Danish parameters.

### Finding 7: Undefined Acronym "EGM"
*   **Severity**: 🟢 Nit
*   **Affected Scope**: Section "Verification Plan" (line 390), Document Footer (line 394).
*   **Discrepancy Description & Rationale**: Line 390 references "EGM Verification" and line 394 states "*Drafted with EGM*". "EGM" is never defined inline or expanded anywhere in the document.

### Finding 8: Misleading "Offscreen" Terminology Within a Manifest V2 Context
*   **Severity**: 🟢 Nit
*   **Affected Scope**: Section "Architectural Overview" (line 94, line 108), Section "Detailed Implementation Plan: 12. extension/offscreen.js" (lines 337–340).
*   **Discrepancy Description & Rationale**: The document designates `extension/offscreen.js` as an "Offscreen / Action Canvas" worker. In WebExtension development, "Offscreen Documents" (`chrome.offscreen`) is a specific Manifest V3 API. Because this design explicitly retains Manifest V2, using the term "Offscreen" creates confusion unless clarified as a regular HTML canvas/iframe helper.

### Finding 9: Ambiguous Client Configuration Injection for Claude Code
*   **Severity**: 🟢 Nit
*   **Affected Scope**: Section "Technical Plan: 5. Embedded Assets & Self-Installer" (lines 149–153), Section "Detailed Implementation Plan: 7. installer.rs" (lines 304–305).
*   **Discrepancy Description & Rationale**: Line 151 lists "Claude Code: `~/.claude.json` / `claude mcp add browser-mcp <path>`". The document does not clarify whether `installer.rs` edits a JSON file directly or executes an external CLI subprocess.
