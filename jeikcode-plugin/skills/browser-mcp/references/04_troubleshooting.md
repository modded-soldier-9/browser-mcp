# 04 — Troubleshooting & Operational Reliability

Guidance for diagnosing connection, permission, and browser attachment issues.

---

## 1. Debugger Detach & Eviction Scenarios

In Chromium, extensions control tabs via Chrome DevTools Protocol (`chrome.debugger`). A tab may report:
`"Debugger is not attached to the tab with id: XXX"`

### Root Causes & Solutions:
1. **User Dismissed Debugger Banner**:
   - Chromium displays a top banner: *"An extension is debugging this browser"*.
   - If the user clicks **Cancel**, Chromium blocks re-attachment for that tab session.
   - **Fix**: Open a fresh tab via `browser_navigate(url, new_tab=true)` or restart the browser.
2. **Anti-Automation SPA Eviction**:
   - SPAs like Apple App Store Connect, Salesforce, or Sentry detect active DevTools attachments and invoke `debugger` statements or detach events.
   - **Fix**: Browser MCP incorporates 4 automatic backoff retries (100ms, 300ms, 500ms) with `debuggerAttach()` auto-healing. If detached, call `browser_reattach_debugger()`.
3. **Tab Closed by User**:
   - If a tab is closed manually in Brave, Browser MCP marks the tab as closed and auto-cleans the session reference without terminating the bridge.

---

## 2. Port Pool & Standby Daemon

- Browser MCP dynamically scans and binds to ports **9876 through 9895**.
- If port `9876` is in use by another session or client (e.g. OpenCode or Cursor), the server automatically claims `9877`, `9878`, etc.
- The Brave extension probes all 20 ports every 2 seconds and connects immediately to any active bridge.
- **Standby Mode**: Running `npx browser-mcp serve` (or the persistent background process) keeps port `9876` warm indefinitely so extension connections never drop during agent pauses.

---

## 3. Session Identification & Multi-Chat Routing

- Each active JeikCode turn transmits `JEIKCODE_SESSION_ID` as the `agentId`.
- Tabs opened by your session are assigned to your session's unique color-coded group (`JeikCode 1`, `JeikCode 2`, etc.).
- If `browser_close_tab` reports that a tab does not belong to your session, call `browser_list_tabs` first to inspect your session's active tab IDs.

---

## 4. Extension Reloading in Brave

If the extension requires a reload after updating:
1. Open `brave://extensions` in Brave.
2. Toggle Developer mode ON (top right).
3. Click the circular **Reload** icon on **Browser MCP**.
4. The extension will reconnect to the WebSocket bridge within 1–2 seconds.
