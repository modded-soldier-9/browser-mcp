# Browser MCP Plugin for JeikCode

A native, first-class JeikCode plugin for browser automation, connecting AI agents directly to your real Brave or Chrome browser session with 40 tools, token preservation, and multi-session isolation.

---

## Features
- **Built on JeikCode Principles**: Token preservation, funnel retrieval pipeline, context discipline.
- **Dedicated AI Skill (`browser-mcp`)**: Progressive instructions teaching the AI when and how to navigate, extract, click, fill, solve CAPTCHAs, and handle 2FA.
- **Brave & Chrome MV2 Compatibility**: Persistent background page, zero-drop WebSocket bridge (`ws://127.0.0.1:9876-9895`).
- **Session Isolation**: Automatic color-coded tab grouping (`JeikCode 1`, `JeikCode 2`, etc.) per conversation turn.
- **Complex UI Support**: Label fallback for 0×0 styled toggles/switches, dynamic comboboxes, and top-level `await` evaluation.

---

## Directory Structure
```
browser-mcp/
├── plugin.json
├── README.md
└── skills/
    └── browser-mcp/
        ├── SKILL.md
        └── references/
            ├── 01_tools_cheat_sheet.md
            ├── 02_token_preservation.md
            ├── 03_spa_and_interaction.md
            └── 04_troubleshooting.md
```

---

## Installation in JeikCode
```bash
jeikcode plugin install browser-mcp
```
Or place directly in `~/.jeikcode/plugins/browser-mcp` and run `/reload`.
