# Extension Modular Source (`src`)

## Overview
Modular helper components supporting the Browser MCP Chrome/Brave extension runtime, including CDP client helpers, DOM inspection routines, dialog management, and session state persistence.

## Interface
- `cdp-client.js`: Chrome DevTools Protocol helper abstractions.
- `dialog-manager.js`: Human-in-the-loop and browser dialog interception and control.
- `dom-inspector.js`: DOM inspection and element coordinate resolution routines.
- `input-actions.js`: Synthetic and CDP-based keyboard and mouse input handling.
- `session-store.js`: Tab-to-session routing and in-memory session index.
- `storage-manager.js`: Asynchronous wrappers around `chrome.storage.local`.

## Invariants
- Extension modules operate strictly within the Chrome extension sandbox.
- All DOM inspection and interaction routines respect origin isolation and security boundaries.

## Side Effects
- Invokes Chrome extension APIs (`chrome.debugger`, `chrome.storage.local`, `chrome.tabs`).

## Verification
- Run: `node scripts/build-extension.mjs`
