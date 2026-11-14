# Turnkey MCP Client Configurations

This directory contains turnkey configuration files for connecting **Browser Control** (formerly Browser MCP) to major AI editors, IDEs, and coding assistants.

Ensure the `browser-control` binary is built and available on your system `PATH` (or replace `"browser-control"` in the JSON configuration with the absolute path to your binary):

```bash
cargo build --release --manifest-path crates/browser-mcp-server/Cargo.toml
```

*(Note: `browser-mcp` remains available as a backward-compatible alias).*

---

## 1. Claude Desktop

Copy or merge [claude-desktop/claude_desktop_config.json](claude-desktop/claude_desktop_config.json) into your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "browser-control": {
      "command": "browser-control"
    }
  }
}
```

---

## 2. Cursor

Copy or merge [cursor/mcp.json](cursor/mcp.json) into:

- **Global**: `~/.cursor/mcp.json`
- **Workspace-specific**: `.cursor/mcp.json` (at your repository root)

```json
{
  "mcpServers": {
    "browser-control": {
      "command": "browser-control"
    }
  }
}
```

---

## 3. Windsurf

Copy or merge [windsurf/mcp_config.json](windsurf/mcp_config.json) into:

- **Path**: `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "browser-control": {
      "command": "browser-control"
    }
  }
}
```

---

## 4. Visual Studio Code (Copilot Agent Mode)

> **Important**: VS Code uses the top-level key `"servers"` instead of `"mcpServers"`.

Copy or merge [vscode/mcp.json](vscode/mcp.json) into:

- **Workspace-specific**: `.vscode/mcp.json` (at your repository root)
- **User-level**: Open via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P` -> `Preferences: Open User Configuration (MCP)`)

```json
{
  "servers": {
    "browser-control": {
      "command": "browser-control"
    }
  }
}
```

---

## 5. Claude Code CLI

Add `browser-control` via the CLI command:

```bash
claude mcp add browser-control -- browser-control
```

Or copy [claude-code/mcp.json](claude-code/mcp.json) as `.mcp.json` in your project root.

---

## 6. Antigravity / Gemini CLI

Copy or merge [antigravity/mcp_config.json](antigravity/mcp_config.json) into:

- **Path**: `~/.gemini/config/mcp_config.json`

```json
{
  "mcpServers": {
    "browser-control": {
      "command": "browser-control"
    }
  }
}
```
