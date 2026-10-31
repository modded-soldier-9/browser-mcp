# Intermediate Zoom Out Review Report

*   **Target File**: `docs/designs/standalone-rust-browser-mcp.md`
*   **Active Scope**: Lines 1..394 (Full Document)
*   **Reviewer**: Skeptical Architect (`egm-zoom-out`)
*   **Context**: Evaluated in light of findings from Initial Zoom Out, Comprehension, and Critic stages.

--------------------------------------------------------------------------------

## High-Altitude Alignment & Synthesis

The Intermediate Zoom Out confirms the architectural core while reconciling feedback from the Comprehension and Critic reviews. The project must maintain strict discipline against over-engineering while addressing the valid security and structural gaps raised by the critics.

### Architectural Decisions Confirmed

1. **Prune Speculative File Tokens**:
   - *Critic & Comprehension Concern*: The sandboxed extension cannot read `~/.browser-mcp/session.token`.
   - *Zoom Out Verdict*: Avoid building complex cross-process IPC pairing mechanisms just to pass a local token. The standard security model for local browser extensions connecting to local daemons is binding strictly to loopback (`127.0.0.1`) and validating the `Origin: chrome-extension://[a-p]{32}` header during the WebSocket upgrade handshake. For static secrets, injecting a pre-generated token into `extension/config.js` at `browser-mcp install` time provides zero runtime overhead. Do NOT implement complex ephemeral token discovery protocols.

2. **Sequential Command Ordering via Async Channels**:
   - *Critic Concern*: Spawning uncontrolled Tokio tasks for all commands risks race conditions between dependent browser actions.
   - *Zoom Out Verdict*: Agree. While `ping` and server status queries must bypass the queue for immediate response, browser mutation commands targeting an active tab must be serialized through a simple per-session Tokio `mpsc` queue. This guarantees order of execution without complex distributed locks.

3. **Eliminate Redundant Process Polling**:
   - *Critic & Comprehension Concern*: Polling parent PID across Windows, Linux, and macOS introduces platform-specific system calls (`sysinfo`, `OpenProcess`, `getppid`).
   - *Zoom Out Verdict*: In a native standalone binary, Tokio stdin EOF (`read_line() == Ok(0)`) is the single source of truth for host client termination. Relying solely on stdin EOF and OS termination signals (SIGINT/SIGTERM / Windows Ctrl-C handler) eliminates the need for `sysinfo` and periodic process scanning entirely.

4. **Scope of Self-Installation (`browser-mcp install`)**:
   - *Zoom Out Verdict*: Self-installation must remain simple: unpack extension assets to `~/.browser-mcp/extension/`, generate static config if needed, and print verified configuration snippets for client assistants. Writing automated file mutations to multiple third-party editor config files should be carefully scoped with atomic writes (`tempfile` + rename) or deferred to user CLI registration commands (`claude mcp add`).

--------------------------------------------------------------------------------

## Summary of Stage 8 Directives

*   **Directive 1**: Close Open Question 1 by adopting `127.0.0.1` binding + strict `Origin` header validation, with optional static token injection into `extension/config.js` during install.
*   **Directive 2**: Retain `browser_extract_token` as a browser automation tool in `tools_schema.json` and `tools.rs`; remove the claim that it extracts local server tokens.
*   **Directive 3**: Add `## Risks & Mitigations` covering port exhaustion, extension disconnections, and sequential command queues.
*   **Directive 4**: Strip `sysinfo` and background process polling; terminate exclusively on Tokio stdin EOF and OS signals.
