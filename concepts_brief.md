# Concept Brief: Browser MCP v2.2 — Token-Efficient Semantic Accessibility & Context Shield

## Problem Statement & Motivation
Modern web pages are deeply nested with layout wrappers (`<div>`, `<span>`, CSS styling classes, SVG icons), frequently exceeding 50,000 characters of raw HTML. When an AI agent navigates a web application over multiple turns (e.g., searching, logging in, selecting dropdowns, and extracting reports), dumping raw DOM or unfiltered accessibility trees consumes 10,000 to 25,000 tokens per interaction. Within 5–10 steps, the agent's context window is degraded, attention drift occurs, and operating costs escalate.

While Browser MCP v2.1.0 introduced AXTree snapshotting (`format: "snapshot"`), competitive analysis against modern browser automation engines (`browser-use`, `@playwright/mcp`, Stagehand, and Chrome DevTools MCP) reveals critical architectural improvements:
1. **Unfiltered Tree Bloat**: Even accessibility trees retain hundreds of static structural containers and non-actionable text nodes unless explicitly pruned for interactive agents.
2. **Repetitive State Re-Emission**: Agents repeatedly receive the full page state after minor actions (e.g. typing a single field or opening a dropdown), re-ingesting 95% identical tokens.
3. **Context Window Contamination**: Lengthy tables or dashboards exhaust client context limits unless guarded by out-of-band disk storage or query-based element discovery.

Browser MCP v2.2 introduces a **Semantic Accessibility Engine & Context Shield**: distilling pages strictly into actionable interactive targets (`[e1]`, `[e2]`), streaming state deltas after user actions, caching full snapshots out-of-band on disk, and exposing targeted semantic element search.

---

## Core Invariants & Non-Negotiables
1. **[token:budget-ceiling]**: A standard interactive snapshot of any production web page must not exceed 1,500 tokens in the MCP client response payload.
2. **[action:handle-determinism]**: Element reference handles (`[e1]`, `[e2]`, ...) must remain stable within a tab turn and map directly to native CDP/DOM nodes without XPath or CSS selector guesswork.
3. **[shield:context-safety]**: Payloads exceeding configurable threshold limits (default: 2,500 tokens) must automatically persist to local cache (`~/.browser-mcp/snapshots/`) and return a summarized index with query handles, preventing context overflow.
4. **[bridge:zero-node]**: All parsing, filtering, and indexing logic must execute strictly within the compiled Rust host engine and persistent MV2 extension; zero external runtime dependencies.
5. **[security:origin-containment]**: Snapshot caching and element extraction remain strictly bound to loopback `127.0.0.1` and the active tab's security origin.

---

## Proposed Technical Approach & Architecture

```text
┌────────────────────────────────────────────────────────┐
│           AI Coding Assistant (Client LLM)             │
└───────────────────────────┬────────────────────────────┘
                            │ (Concise Tool Call: browser_get_page_content)
┌───────────────────────────▼────────────────────────────┐
│   Browser MCP Native Host Engine (Rust / browser-mcp)  │
│   • Token Counter & Context Shield Guard               │
│   • Delta Diff Engine (Compares Prior vs. Current AX)  │
│   • Local Disk Spooler (~/.browser-mcp/snapshots/)     │
└───────────────────────────┬────────────────────────────┘
                            │ (WebSocket JSON-RPC)
┌───────────────────────────▼────────────────────────────┐
│      Brave / Chrome Extension (MV2 Background Bridge)   │
│   • Chrome DevTools Protocol Accessibility.getFullAXTree│
│   • Interactive Pruner (Filters non-actionable roles)  │
│   • Deterministic Ref Assignor ([e1], [e2]...)         │
│   • Viewport & Bounding Box Normalizer (x, y)          │
└───────────────────────────┬────────────────────────────┘
                            │ (Direct CDP Execution)
┌───────────────────────────▼────────────────────────────┐
│               Target Web Page (Brave / Chrome)         │
└────────────────────────────────────────────────────────┘
```

### Key Architectural Capabilities

#### 1. Interactive Semantic Distillation (`interactive_only: true`)
The extension queries `Accessibility.getFullAXTree` via CDP, but filters the tree through an interactive whitelist:
- **Included Roles**: `button`, `link`, `textbox`, `searchbox`, `checkbox`, `radio`, `combobox`, `listbox`, `menuitem`, `tab`, `dialog`, `switch`.
- **Filtered Out**: Static wrappers (`generic`, `group`, `none`), purely decorative images, unlabelled containers, and hidden off-viewport layout artifacts.
- **Output Structure**: Compact YAML/indented string:
  ```text
  [e1] button "Sign in" (x: 0.85, y: 0.05)
  [e2] textbox "Email" [required, value=""] (x: 0.45, y: 0.32)
  [e3] textbox "Password" [protected] (x: 0.45, y: 0.38)
  [e4] link "Forgot password?" (x: 0.45, y: 0.42)
  ```

#### 2. Incremental State Deltas (`format: "delta"`)
Instead of dumping the entire page state after an action:
- Rust maintains an in-memory SHA-256 tree hash and node map of the active tab.
- When an action executes, the response returns the mutation delta:
  ```text
  State Delta:
  + [e12] dialog "Confirm Order" (opened)
  + [e13] button "Place Order" (active)
  ~ [e2] textbox "Email" value="user@example.com"
  - [e1] button "Sign in" (hidden)
  ```
- Result: Reduces multi-step payload tokens by **80% to 90%**.

#### 3. Targeted Element Query (`browser_search_elements`)
When interacting with complex dashboards, agents do not need the full tree. They query by intent:
- Call: `browser_search_elements({ text: "Export CSV", role: "button" })`
- Response: Returns only the matching 1–3 candidate elements with their immediate container context, burning < 100 tokens.

#### 4. Context Shield Disk Spooling
If a page contains extensive tabular data (e.g. 100 table rows) and exceeds 2,500 tokens:
- Full distilled representation writes to `~/.browser-mcp/snapshots/tab_<id>_<timestamp>.txt`.
- Agent receives:
  ```text
  Page Title: Financial Statement (14,200 characters)
  Primary Actionable Elements: 8 buttons, 2 dropdowns.
  Full snapshot saved to: C:\Users\modded\.browser-mcp\snapshots\tab_1.txt
  Use browser_search_elements(query) or read specific lines via file reader.
  ```

---

## Synthesized Goldfish Review Findings

### 1. Contrarian / YAGNI (egm-zoom-out)
- **Strengths**: Directly attacks the #1 failure mode of AI browser agents: context exhaustion and slow inference latency.
- **Risks & Pushback**: Storing full state trees in Rust memory introduces tab synchronization complexity if the user manually closes or navigates tabs in the browser.
- **Recommendations**: Keep state storage in Rust ephemeral and keyed to CDP `targetId`. If a hash mismatch or navigation occurs, transparently fall back to a full clean snapshot rather than complex synchronization logic.

### 2. Cost, Quota & Token Economics (egm-design)
- **Strengths**: Slashing average per-action token volume from 15,000 down to 600 tokens directly translates to a ~25x cost reduction on frontier models (Claude 3.5 Sonnet, GPT-4o).
- **Risks & Pushback**: Over-pruning can omit critical context (e.g., alert banners, validation error messages that use non-standard `<div>` styling without ARIA alerts).
- **Recommendations**: Include any element with text content that follows an input validation error or contains ARIA roles `alert`, `status`, or `tooltip`.

### 3. UX & Developer Ergonomics (egm-comprehension / egm-style)
- **Strengths**: Element handles `[e1]`, `[e2]` eliminate fragile CSS/XPath prompt generation. Agents simply emit `browser_click({ element: "e1" })`.
- **Risks & Pushback**: If handles change after an incremental delta without the agent realizing it, clicks could target the wrong element.
- **Recommendations**: Keep handle IDs monotonically increasing during a page session. An element retains `e1` until the page fully navigates.

### 4. Migration & Backward Compatibility (egm-codebase-details)
- **Strengths**: 100% backward compatible with existing 40 MCP tools. `format="snapshot"` and `format="raw"` remain available. The new modes (`format="interactive"`, `format="delta"`) are opt-in parameter extensions.
- **Risks & Pushback**: The existing Rust `tools_schema.json` must be updated, and `scripts/check-docs.py` must validate the updated parameters.
- **Recommendations**: Ensure schema updates preserve dual-mapping in `extension/background.js`.

### 5. Observability & SRE Debuggability (egm-implementation-readiness)
- **Strengths**: Local snapshot spooling (`~/.browser-mcp/snapshots/`) provides an instant local audit trail for debugging failed agent runs.
- **Risks & Pushback**: Unchecked snapshot writes could accumulate disk space over months of heavy usage.
- **Recommendations**: Implement LRU retention capping snapshot files at 50 MB total or 100 files max in `~/.browser-mcp/snapshots/`.

### 6. Long-Term Tech Debt & Maintenance (egm-structural)
- **Strengths**: Consolidating DOM filtering inside the extension's CDP pipeline avoids pulling heavy external parsing crates into the Rust binary, keeping `browser-mcp.exe` lean (~3 MB).
- **Risks & Pushback**: Custom JavaScript filtering inside `background.js` must remain clean, modular, and well-commented.
- **Recommendations**: Isolate the interactive AXTree visitor in `extension/src/dom-inspector.js`.

---

## Implementation Roadmap & Phased Execution

- **Phase 1: Interactive AXTree Pruner**:
  - Implement role filtering and monotonic ref assignment (`[e1]`, `[e2]`) in `extension/src/dom-inspector.js`.
  - Add `format="interactive"` to `browser_get_page_content` schema.
  - Verify token savings against benchmark pages (GitHub, Hacker News, Stripe Dashboard).
- **Phase 2: Targeted Element Search Tool**:
  - Add `browser_search_elements` tool to `crates/browser-mcp-server/tools_schema.json` and extension bridge dispatcher.
  - Test sub-100-token element resolution.
- **Phase 3: Context Shield & Local Disk Spooler**:
  - Implement token counter and file spooler in Rust (`crates/browser-mcp-server/src/sandbox.rs` / `shield.rs`).
  - Add automatic truncation and spooling path output for payloads exceeding 2,500 tokens.
- **Phase 4: Incremental State Delta Engine**:
  - Implement hash-based AXTree diffing in Rust server.
  - Add `format="delta"` parameter option.

---

## Open Questions & Strategic Trade-Offs
1. **Visual vs. Semantic Fallback**: When an interactive element has no ARIA role and is a plain clickable SVG (common on custom web apps), should Browser MCP automatically compute its bounding box coordinates `[x, y]` and label it `[eX] clickable-icon (x: 0.12, y: 0.04)`? (Recommended: Yes, via CDP hit-testing).
2. **Delta Granularity**: Should deltas report only added/removed interactive elements, or also visual text changes? (Recommended: Interactive elements + alert/error text only to prevent noise).
