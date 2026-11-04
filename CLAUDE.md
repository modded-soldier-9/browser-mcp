# Browser MCP Developer Guide

Standalone native Rust browser automation bridge for AI coding assistants (Claude Code, Cursor, Antigravity, OpenCode).

## Core Architecture

- `crates/browser-mcp-server/`: Compiled native Rust server (`browser-mcp` / `browser-mcp.exe`).
  - Stdio JSON-RPC 2.0 interface with asynchronous reader/writer tasks.
  - Immediate MCP `ping` fast-path handling.
  - Loopback WebSocket bridge on `127.0.0.1` (ports 9876–9895) with `Origin: chrome-extension://[a-p]{32}` verification.
  - Zero-dependency embedded self-installer via `include_dir!`.
- `extension/`: Chrome and Brave Manifest V2 persistent WebExtension.
  - `extension/offscreen.js`: Persistent WebSocket client bridge.
  - `extension/background.js`: Tab groups, navigation, input injection, and action dispatch.

## Development Workflows

### Build & Check
```bash
# Check compilation
cargo check --manifest-path crates/browser-mcp-server/Cargo.toml

# Build debug binary
cargo build --manifest-path crates/browser-mcp-server/Cargo.toml

# Build optimized release binary
cargo build --release --manifest-path crates/browser-mcp-server/Cargo.toml
```

### Tests
```bash
# Run Rust integration test suite
cargo test --manifest-path crates/browser-mcp-server/Cargo.toml
```

### Self-Installation
```bash
# Extract bundled extension and register client configs
cargo run --manifest-path crates/browser-mcp-server/Cargo.toml -- install
```

### Documentation & Extension Gates
```bash
# Validate extension assets and syntax
node scripts/build-extension.mjs

# Verify documentation integrity across all 43 tools
python scripts/check-docs.py
```
