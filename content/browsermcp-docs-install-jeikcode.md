# Add Browser MCP to JeikCode
*Suggested meta description: "Native first-class browser automation for JeikCode. Drive real Chrome and Brave sessions with 40 tools, session isolation, and Human-in-the-Loop."*

**Give JeikCode native control of your real, already-logged-in Brave or Chrome browser.** 40 browser tools, real cookies and active sessions, Human-in-the-Loop 2FA and CAPTCHA support, and dedicated color-coded tab groups for each JeikCode agent session.

---

## Quick Setup (1 Minute)

### 1. Register with JeikCode CLI

Run this command in your terminal:

```bash
jeikcode mcp add browser-mcp npx -y browser-mcp@latest --global
```

Or run the Browser MCP installer directly:

```bash
npx browser-mcp install
```

The installer detects your JeikCode installation automatically and registers `browser-mcp` with `scope: "session"` and `maxConcurrentCalls: 1`.

### 2. Manual Configuration (Optional)

Alternatively, add `browser-mcp` to your global `~/.jeikcode/mcp.json` or project-level `.mcp.json`:

```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "npx",
      "args": ["-y", "browser-mcp@latest"],
      "timeout_ms": 30000,
      "maxConcurrentCalls": 1,
      "scope": "session"
    }
  }
}
```

### 3. Load the Extension in Brave / Chrome

1. Open Brave (`brave://extensions`) or Chrome (`chrome://extensions`).
2. Toggle **Developer mode** in the top right.
3. Click **Load unpacked** and select `~/.browser-mcp/extension` (or the `extension/` directory from the repository).
4. The **Browser MCP** extension is now active.

### 4. Reload and Verify in JeikCode

In JeikCode, reload your configuration:
- In TUI / WebUI, type `/mcp reload` or `/reload`.
- In an active agent turn, `jeikcode_config_reload` reloads configurations seamlessly without restarting.

Now ask JeikCode:
> Take a screenshot of my current browser tab.

You get an image back instead of *"I don't have browser access"*. JeikCode interacts directly with your browser, creating a dedicated `JeikCode` tab group and returning live results!

---

## Key JeikCode Features

- **`scope: "session"` Multi-Agent Isolation**: Each active coding session gets its own isolated browser state and tab group (`JeikCode 1`, `JeikCode 2`), mapped through `JEIKCODE_SESSION_ID`.
- **`maxConcurrentCalls: 1` Safety Gate**: State-mutating browser interactions (clicks, typing, navigation) are serialized per session, preventing race conditions.
- **Manifest V2 Compatibility for Brave**: Complete support for Brave browser's Manifest V2 architecture with persistent background workers and zero-drop WebSocket bridges.
- **Human-in-the-Loop Dialogs**: `browser_ask_user` prompts for user verification, 2FA codes, or credentials directly in your real browser window.
