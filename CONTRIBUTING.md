# Contributing to Browser MCP

Thanks for your interest in contributing! Browser MCP is open source and welcomes contributions of all kinds.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/modded-soldier-9/browser-mcp.git
cd browser-mcp

# Build the Rust server binary
cargo build --release --manifest-path crates/browser-mcp-server/Cargo.toml

# Run the self-installer to unpack the extension and print client config
./target/release/browser-mcp install

# Load extension in Chrome or Brave
# 1. Open brave://extensions or chrome://extensions
# 2. Enable "Developer mode" (top right)
# 3. Click "Load unpacked"
# 4. Select the ~/.browser-mcp/extension folder (or ./extension from the repo)

# Run integration tests
cargo test --manifest-path crates/browser-mcp-server/Cargo.toml

# Verify extension and documentation
npm test
npm run check-docs
```

## Project Structure

```
crates/browser-mcp-server/  # Standalone Rust MCP server
  src/main.rs               # Async stdio engine & JSON-RPC dispatcher
  src/bridge.rs             # WebSocket bridge (ports 9876-9895) & origin security
  src/tools.rs              # 40 MCP tool definitions and local execution handlers
  src/installer.rs          # Embedded extension self-installer (include_dir!)
  src/watchdog.rs           # Zero-overhead stdin EOF & termination handler
  tools_schema.json         # Normalized tool schemas (source of truth)
  tests/bridge_test.rs      # Native integration tests

extension/                  # Chrome/Brave extension (Manifest V2 persistent)
  background.js             # Automation logic, session isolation, and CDP mutex
  offscreen.js              # WebSocket client bridge connecting to Rust server
  manifest.json             # Manifest V2 configuration
  popup.html / popup.js     # Status popup UI

scripts/                    # Build, documentation, and validation tooling
  build-extension.mjs       # Extension syntax validation and packaging
  generate-docs.py          # Static documentation site generator
  check-docs.py             # Documentation integrity and link checker

benchmarks/                 # Benchmark harnesses
  latency.mjs               # Round-trip latency benchmark
  inspect.mjs               # Tool response inspector
```

## How to Contribute

### Bug Reports
Open a [Bug Report](https://github.com/modded-soldier-9/browser-mcp/issues/new?template=bug.yml) describing the unexpected behavior, browser version, and OS.

### Feature Requests
Open a [Feature Request](https://github.com/modded-soldier-9/browser-mcp/issues/new?template=wish.yml) describing your use case.

### Code Contributions
1. Fork the repository (`https://github.com/modded-soldier-9/browser-mcp`).
2. Create a feature branch: `git checkout -b feat/my-improvement`.
3. Make changes and verify:
   - `cargo test --manifest-path crates/browser-mcp-server/Cargo.toml`
   - `node scripts/build-extension.mjs`
   - `python scripts/check-docs.py`
4. Commit: `git commit -m "feat: description of improvement"`.
5. Push to your fork and submit a Pull Request.
