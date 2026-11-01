# Browser MCP Server Source (`src`)

## Overview
Core implementation of the native Rust Model Context Protocol (MCP) server for browser automation. It connects LLM agent clients over stdio or persistent WebSocket bridge servers to local Chrome and Brave browser extensions, dispatching browser commands, validating security boundaries, and managing process lifecycles.

## Interface
- [`Bridge` (struct)](file:///crates/browser-mcp-server/src/bridge.rs#L37): WebSocket bridge manager managing ports and extension connections.
  - [`Bridge::new() -> Self`](file:///crates/browser-mcp-server/src/bridge.rs#L45): Initializes bridge instance with configured port bounds.
  - [`Bridge::ensure_port(&self) -> Result<u16, String>`](file:///crates/browser-mcp-server/src/bridge.rs#L68): Scans and binds TCP listener on the first available port (9876-9895).
  - [`Bridge::send_command(&self, method: &str, params: Value, timeout_ms: u64) -> Result<Value, String>`](file:///crates/browser-mcp-server/src/bridge.rs#L245): Dispatches JSON-RPC command to the connected browser extension with profile matching and timeout enforcement.
- [`ExtensionConnection` (struct)](file:///crates/browser-mcp-server/src/bridge.rs#L20): Represents an active WebSocket connection to a browser extension session.
- [`BridgeState` (struct)](file:///crates/browser-mcp-server/src/bridge.rs#L29): Shared bridge state tracking active port, connections, and pending oneshot command channels.
- [`JsonRpcRequest`, `JsonRpcResponse`, `JsonRpcError` (structs)](file:///crates/browser-mcp-server/src/protocol.rs#L5-L29): JSON-RPC 2.0 protocol request, response, and error types.
- [`ToolContent`, `TextContent`, `ImageContent`, `CallToolResult` (structs/enums)](file:///crates/browser-mcp-server/src/protocol.rs#L32-L59): MCP tool execution result structures.
- [`decode_base64(input: &str) -> Option<Vec<u8>>`](file:///crates/browser-mcp-server/src/protocol.rs#L61): Dependency-free Base64 decoding helper.
- [`resolve_screenshot_path(input_path: &str, cwd: &Path) -> Result<PathBuf, String>`](file:///crates/browser-mcp-server/src/sandbox.rs#L3): Sandboxes screenshot destination paths within current working directory.
- [`sanitize_upload_files(files: &[String], cwd: &Path) -> Result<Vec<String>, String>`](file:///crates/browser-mcp-server/src/sandbox.rs#L30): Validates and ensures file paths for upload and drag-and-drop reside strictly within the working directory.
- [`TOOLS_RAW`, `TOOLS_JSON`](file:///crates/browser-mcp-server/src/tools.rs#L8-L12): Precompiled schemas for 41 browser automation tools.
- [`METHOD_MAP`](file:///crates/browser-mcp-server/src/tools.rs#L14-L57): Mapping between MCP tool identifiers (`browser_*`) and extension bridge method names.
- [`ContextShield` (struct)](file:///crates/browser-mcp-server/src/shield.rs#L11): Context protection manager spooling large payloads (>2500 tokens) to disk (`~/.browser-mcp/snapshots/`) with in-band pagination.
- [`DeltaEngine` (struct)](file:///crates/browser-mcp-server/src/delta.rs#L5): State mutation diff engine tracking per-tab element history and streaming line diffs for `format="delta"`.
- [`get_tools_list(strip_prefix: bool) -> Vec<Value>`](file:///crates/browser-mcp-server/src/tools.rs#L56): Retrieves MCP tool schema definitions, optionally stripping the `browser_` prefix.
- [`normalize_tool_name(name: &str) -> String`](file:///crates/browser-mcp-server/src/tools.rs#L71): Normalizes tool names by ensuring the `browser_` prefix is present when matching methods.
- [`run_installer(force: bool) -> Result<(), String>`](file:///crates/browser-mcp-server/src/installer.rs#L14): Extracts embedded Chrome extension files to `~/.browser-mcp/extension/` and prints client configurations.
- [`spawn_watchdog(shutdown_tx: broadcast::Sender<()>)`](file:///crates/browser-mcp-server/src/watchdog.rs#L5): Spawns background task monitoring standard input EOF and OS termination signals to trigger graceful shutdown.

## Invariants
- [bridge:origin_check] WebSocket connections must supply an `Origin` header matching `^chrome-extension://[a-p]{32}$`; non-matching origins are rejected with HTTP 401.
- [bridge:port_range] WebSocket bridge only binds to localhost (`127.0.0.1`) across ports 9876 to 9895; fails if all ports are exhausted.
- [sandbox:cwd_containment] Screenshot targets and file upload paths must strictly resolve within the canonical working directory (`cwd`) to prevent directory traversal.
- [watchdog:lifecycle] Stdin EOF or OS termination signals (`ctrl_c`, SIGTERM) trigger immediate server shutdown with zero polling overhead.
- [main:stdio_framing] Standard I/O MCP transport processes newline-delimited JSON-RPC requests, writing serialized responses to stdout.

## Side Effects
- Binds TCP sockets on `127.0.0.1:9876-9895` and handles WebSocket frames.
- Reads environment variables: `BROWSER_MCP_BASE_PORT`, `BROWSER_MCP_MAX_PORT`, `BROWSER_MCP_STRIP_TOOL_PREFIX`, `BROWSER_MCP_PROFILE`, `BROWSER_MCP_AGENT`, `JEIKCODE_SESSION_ID`, `ATOMCODE_SESSION_ID`.
- Filesystem writes: saves captured screenshot images directly to disk when path is specified in `screenshot` arguments.
- Spawns background asynchronous Tokio tasks for WebSocket listening, port warming, and process watchdog monitoring.

## Verification
- Run: `cargo test -p browser-mcp-server`
