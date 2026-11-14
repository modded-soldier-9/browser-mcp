# Browser MCP Extension Runtime

## Overview
Manifest V2 persistent browser extension connecting AI coding agents directly to live Chrome and Brave browser sessions. It implements a persistent background worker, an offscreen WebSocket bridge handling multi-session connections on ports 9876-9895, tab group color-coded session isolation, per-tab CDP command mutexes, and human-in-the-loop interaction overlays.

## Interface
- `[manifest.json](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/manifest.json)`: Manifest V2 extension definition specifying background scripts (`background.js`, `offscreen.js`), permissions (`debugger`, `tabs`, `tabGroups`, `cookies`, `storage`), and loopback CSP.
- `[background.js:sessions](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/background.js#L227)`: In-memory and persisted `Map<number, Session>` indexing active sessions by port with color, label, PID, and tab IDs.
- `[background.js:getSession](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/background.js#L277)`: Allocates or retrieves session metadata with collision-free numbering and color assignment.
- `[background.js:addTabToSession](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/background.js#L440)`: Enrolls tab into session, updates Chrome Tab Group, and triggers LRU eviction.
- `[background.js:adoptOrphanedSession](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/background.js#L341)`: Reconnect adoption mechanism re-linking surviving tabs to reconnected server instances sharing the same PID.
- `[background.js:withTabLock](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/background.js#L562)`: Mutex queue ensuring CDP commands on the same tab execute serially without debugger conflicts.
- `[background.js:debuggerAttach](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/background.js#L198)`: Attaches Chrome DevTools Protocol (CDP 1.3) debugger target to tab.
- `[background.js:cdpSend](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/background.js#L199)`: Dispatches CDP protocol methods with Promise resolution.
- `[offscreen.js:scanPorts](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/offscreen.js#L162)`: Scans local port range (9876-9895) using non-throttling HTTP GET probes.
- `[offscreen.js:tryConnect](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/offscreen.js#L194)`: Opens WebSocket connection on detected active port and routes JSON-RPC messages to background page.
- `[popup.js:paintStatus](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/popup.js#L37)`: Controls popup status badge, profile switcher, and session overview.
- [src](./src/README.md): Extension source subdirectory contract

## Invariants
- `[background.js:MAX_TABS_PER_SESSION](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/background.js#L416)`: Maximum 20 open tabs per session; additional tabs trigger LRU eviction of oldest non-active tabs.
- `[background.js:withTabLock](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/background.js#L562)`: All CDP operations targeting the same `tabId` are serialized through `tabLocks` Promise chains.
- `[background.js:adoptOrphanedSession](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/background.js#L341)`: Orphan adoption is permitted only when client PID matches and donor port is absent from `mcpPorts`.
- `[offscreen.js:harServer](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/offscreen.js#L132)`: WebSockets are only opened after an HTTP GET probe returns HTTP 426 Upgrade Required.
- `[offscreen.js:scanPorts](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/offscreen.js#L162)`: Port scanner operations are guarded by `iLuften` Set and a 15-second timeout to prevent probe accumulation.
- `[manifest.json:persistent](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/manifest.json#L29)`: Extension background runtime remains persistent under Manifest V2 to prevent disconnection timeouts.

## Side Effects
- `[background.js:chrome.debugger](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/background.js#L198)`: Attaches to tabs, issues hardware mouse/keyboard events, and captures accessibility trees and screenshots.
- `[background.js:chrome.tabs](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/background.js#L462)`: Creates, updates, groups, and closes browser tabs and windows.
- `[background.js:chrome.storage.local](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/background.js#L556)`: Writes and retrieves serialized session state and active MCP ports.
- `[offscreen.js:fetch](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/offscreen.js#L134)`: Emits HTTP requests to loopback addresses `127.0.0.1:9876..9895`.
- `[offscreen.js:WebSocket](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/offscreen.js#L93)`: Establishes duplex communication channels over WebSockets to local MCP servers.
- `[popup.js:chrome.storage.local](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/popup.js#L26)`: Updates `bmcp_profile` setting.

## Verification
- Run: `node scripts/build-extension.mjs`

## Author & Maintainer
Mohamed Elsheikh ([@modded-soldier-9](https://github.com/modded-soldier-9), moddedsoldier@gmail.com)

