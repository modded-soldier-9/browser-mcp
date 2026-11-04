#!/bin/bash
# Browser MCP - setup from a cloned repository
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Browser MCP ==="
echo ""
echo "1. Building the native Rust server..."
cargo build --release --manifest-path "$SCRIPT_DIR/crates/browser-mcp-server/Cargo.toml"
echo "   Done."
echo ""

echo "2. Installing extension and registering server with AI clients..."
"$SCRIPT_DIR/target/release/browser-mcp" install || "$SCRIPT_DIR/crates/browser-mcp-server/target/release/browser-mcp" install
echo ""

echo "3. To load the extension in Chrome or Brave:"
echo "   chrome://extensions → Developer mode → Load unpacked → ~/.browser-mcp/extension"
echo ""
echo "Restart your AI client so it picks up the server."
