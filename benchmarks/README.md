# Benchmarks Harness

## Overview
Diagnostic and performance measurement harness that spawns the native Rust Browser MCP server process (`target/release/browser-mcp.exe`), communicates via JSON-RPC 2.0 over standard I/O, and measures round-trip tool execution latency against an active Chrome or Brave browser instance.

## Interface
- `latency.mjs`: Round-trip latency benchmark measuring per-tool min/median/max durations across configurable iterations (`ROUNDS=5 URL=https://... node benchmarks/latency.mjs`).
  - `callRpc(method, params, ms)`: Dispatches JSON-RPC 2.0 requests over child process stdio with timeout handling.
  - `callTool(name, args)`: Executes tool call request (`tools/call`) against the MCP server.
  - `measureTool(name, args)`: Measures execution latency using high-resolution monotonic time (`process.hrtime.bigint()`).
  - `calculateStats(numbers)`: Computes statistical summary (`{ n, min, med, max }`) from timing arrays.
- `inspect.mjs`: Quick inspection utility executing core tools (`browser_about`, `browser_navigate`, `browser_get_page_content`, `browser_scroll`, `browser_list_tabs`) and printing raw outputs.

## Invariants
- `[benchmarks:binary-target]`: Benchmarks execute the compiled native Rust binary located at `target/release/browser-mcp.exe` (or path specified in `BROWSER_MCP_BIN`).
- `[benchmarks:single-client-cdp]`: Chrome allows only one active CDP debugger client per tab at a time.
- `[benchmarks:port-isolation]`: Test processes acquire a local WebSocket port during execution and must not be run concurrently with other browser-intensive tasks.
- `[benchmarks:process-lifecycle]`: All scripts spawn the server binary, complete the JSON-RPC initialization handshake (`2024-11-05`), clean up opened browser tabs, and terminate child processes on exit.

## Side Effects
- Spawns and kills local Rust child processes running `target/release/browser-mcp.exe` via `child_process.spawn`.
- Connects to local WebSocket bridge ports (9876-9895) with the browser extension.
- Creates, navigates, and closes browser tabs in the active profile.
- Outputs benchmark tables and tool responses to stdout.

## Verification
- Run: `cargo test --manifest-path crates/browser-mcp-server/Cargo.toml`
