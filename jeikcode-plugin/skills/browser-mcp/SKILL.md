---
name: browser-mcp
description: Native browser automation for JeikCode driving real Brave and Chrome sessions. 40 tools covering navigation, focused DOM reading, real CDP mouse/keyboard interaction, styled toggle clicking, top-level await script execution, visual QA screenshots, CAPTCHA solving, and 2FA user interaction. Follows JeikCode token-preservation and session-isolation principles. Use when interacting with live web applications, testing UIs, filling forms, extracting data behind logins, or automating real browser tasks.
metadata:
  author: JeikCode AI
  version: 2.0.0
---

# Browser MCP — Native JeikCode Browser Automation

Direct, persistent, and token-efficient AI agent bridge connecting JeikCode directly to your real Brave or Chrome browser session.

---

## 1. Core Operating Principles in JeikCode

When executing browser automation tasks, adhere strictly to the following 6 core engineering principles:

### I. Token Preservation First (Zero-Waste Context)
- **Use Semantic Accessibility Snapshots**: Preferred inspection method is `browser_get_page_content(format="snapshot")`. It outputs an indented accessibility tree with deterministic element reference handles (`[e1]`, `[e2]`, `[e3]`), saving **95% of tokens** compared to HTML.
- **Direct Element Reference Interaction**: Pass snapshot reference handles directly into interaction tools (e.g. `browser_click("e1")`, `browser_fill("e2", "value")`, `browser_hover("e3")`). This eliminates brittle CSS/XPath selector guessing entirely.
- **Never dump raw, unconstrained HTML.** Big logged-in SPAs easily exceed 1,000,000 characters.
- **Scope Page Reads with Selectors**: When reading text or HTML, always pass `selector` to `browser_get_page_content` (e.g. `selector: "main"`, `selector: "#dashboard"`).
- **Prefer `text` over `html`**: Read plain readable text unless analyzing specific markup attributes.
- **Scroll Virtualized Lists**: For long feeds, transaction tables, or email lists, use `browser_extract_list` rather than taking dozens of repeated page reads.

### II. Real Session Driving (No Fresh Blank Profiles)
- Operates in the user's **actual browser profile** with existing cookies, active logins, SSO sessions, and bookmarks.
- Bypasses bot-detection walls that block headless runners (Playwright/Puppeteer) by using trusted Chromium DevTools Protocol (CDP) events.

### III. Session Isolation & Affinity
- Each JeikCode chat session automatically receives its own isolated, color-coded Brave/Chrome tab group (`JeikCode 1`, `JeikCode 2`), mapped via `JEIKCODE_SESSION_ID`.
- You only see and manage tabs created by your session. You never disturb or close the user's personal tabs or other concurrent sessions.

### IV. Tab Lifecycle Discipline
- **Reuse Before Creating**: Check existing session tabs with `browser_list_tabs` before navigating to avoid tab proliferation.
- **Clean Up Upon Completion**: Always call `browser_close_tab` when an extraction or task is finished. Never leave orphan tabs behind.

### V. Input & Interaction Reliability
- **Real Mouse & Key Events**: `browser_click` and `browser_press_key` send native hardware events. Synthetic `el.click()` is only used as an intelligent fallback.
- **Styled Switch & Toggle Fallback**: For styled 0x0 switches, checkboxes, and radio buttons (Radix, Shadcn, Tailwind, Fluent UI), Browser MCP automatically detects and clicks the associated `<label>`.
- **Top-Level `await` Support**: Code in `browser_execute_script` automatically supports top-level `await`, declarations (`const`/`let`), and multi-statement IIFEs.

### VI. Human-in-the-Loop Fallback
- When hitting 2FA prompts, SMS codes, authenticators, or sensitive account actions, call `browser_ask_user` to present a non-intrusive dialog inside the browser viewport. Never guess passwords.

---

## 2. Standard Interaction Pipeline

Follow this 4-step funnel pipeline for every task:

```
┌────────────────────────────────────────────────────────┐
│ 1. Navigate & Verify: browser_navigate(url)            │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ 2. Semantic Snapshot: browser_get_page_content         │
│    (format="snapshot" -> returns [e1], [e2] handles)   │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ 3. Execute Actions:                                    │
│    • Fill: browser_fill("e2", "value")                 │
│    • Click: browser_click("e1")                        │
│    • Key: browser_press_key("Enter" / "Tab")           │
│    • Script: browser_execute_script(code)              │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ 4. Verification & Cleanup:                             │
│    • Visual confirmation: browser_screenshot()         │
│    • Clean close: browser_close_tab(tab_id)            │
└────────────────────────────────────────────────────────┘
```

---

## 3. Reference Documentation

For deep technical specifications, consult the progressive reference guides in `references/`:
- `references/01_tools_cheat_sheet.md`: Full catalog of all 40 available browser tools and schemas.
- `references/02_token_preservation.md`: Advanced selector patterns and token-saving recipes.
- `references/03_spa_and_interaction.md`: Modal handling, iframe traversal, and dynamic dropdown patterns.
- `references/04_troubleshooting.md`: Debugger attachment diagnostics and recovery protocols.
