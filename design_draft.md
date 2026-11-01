# Browser MCP v2.2 — Token-Efficient Semantic Accessibility & Context Shield

*   **Author:** Mohamed Elsheikh ([@modded-soldier-9](https://github.com/modded-soldier-9))
*   **Status:** Draft
*   **Date:** 2026-11-01
*   **Predecessor Document:** [concepts_brief.md](./concepts_brief.md)

--------------------------------------------------------------------------------

## Overview

Browser MCP v2.2 expands the standalone Rust browser automation engine with an interactive semantic accessibility pipeline and context protection subsystem. While v2.1.0 stabilized the zero-dependency native Rust binary and Manifest V2 WebSocket bridge, multi-step browser interactions still suffer from context window degradation: modern web applications routinely deliver 25,000 to 50,000 tokens of raw DOM and verbose accessibility trees on every page inspection.

This design introduces four integrated capabilities:
1. **Interactive Semantic Distillation (`format="interactive"`)**: Prunes non-actionable layout wrappers (`div`, `span`, purely decorative styling containers) to reduce standard page representations to 400–1,200 tokens with direct reference handles (`[e1]`, `[e2]`).
2. **Context Shield & Out-of-Band Spooling**: Automatically intercepts large payloads exceeding 2,500 tokens, stores full snapshot representations to local disk (`~/.browser-mcp/snapshots/`), and returns an ultra-compact summary index to protect LLM context windows.
3. **Targeted Semantic Element Search (`browser_search_elements`)**: Enables agents to resolve specific interactive targets by text or role directly within the browser process, eliminating the need to ingest entire page trees for simple actions.
4. **State Delta Streaming (`format="delta"`)**: Emits only mutations (+/- added, removed, or altered interactive controls) following actions, cutting repetitive multi-turn token consumption by ~85%.

---

## The Problem

1. **Context Window Exhaustion**: Front-end single-page applications (React, Angular, Next.js) produce deeply nested DOM structures. An agent executing a 10-step form workflow repeatedly ingesting full page state consumes over 150,000 tokens, degrading attention quality and exceeding agent budget ceilings.
2. **Unfiltered Accessibility Tree Bloat**: Raw `Accessibility.getFullAXTree` CDP dumps include hundreds of generic layout containers, static text fragments, and non-actionable wrappers that clutter agent prompts without providing interaction utility.
3. **Repetitive State Re-Emission**: When an agent fills an input or clicks a checkbox, 95% of the page state remains unchanged. Re-sending the entire tree on each turn forces the model to re-read identical content.
4. **Fragile Target Resolution**: Without deterministic, short references, agents guess fragile CSS selectors (`#app > div:nth-child(3) > button`) or complex XPath expressions that break upon minor DOM updates.

---

## Goals

1. **Sub-1,200 Token Baseline**: Deliver an interactive page snapshot mode (`format="interactive"`) that captures all actionable elements while keeping payload sizes under 1,200 tokens for 95% of standard web pages.
2. **Deterministic Monotonic Element Handles**: Assign sequential element references (`[e1]`, `[e2]`, ...) that map directly to native DOM/CDP nodes across interaction tools (`browser_click`, `browser_fill`, `browser_hover`).
3. **Context Shield Protection**: Automatically divert inspection payloads exceeding 2,500 tokens to `~/.browser-mcp/snapshots/tab_<id>.txt`, returning a concise summary index and explicit query prompt.
4. **Targeted Sub-100 Token Search**: Provide `browser_search_elements` to find specific targets by role, name, or text in under 100 tokens.
5. **Incremental State Mutation Streaming**: Provide an opt-in `format="delta"` mode emitting only added, removed, or updated interactive elements following actions.
6. **Zero External Runtime Footprint**: Execute all parsing, pruning, and spooling logic strictly within the compiled Rust host binary and Manifest V2 extension.

---

## Non-Goals

1. **Full-Page Visual Layout Reconstruction**: The interactive semantic snapshot is designed for agent action execution, not pixel-perfect visual reproduction.
2. **Client-Side Heavy Parsing Crates**: Large DOM parsing libraries (such as `scraper` or `html5ever`) will not be linked into the Rust binary; structural filtering is handled natively in the browser extension's CDP pipeline.
3. **Automatic Task Execution / Autonomous Loops**: Browser MCP remains an MCP server providing tools to AI client agents; it does not run autonomous goal-seeking agent loops itself.
4. **Breaking Changes to Existing Tools**: `format="raw"` (HTML) and `format="snapshot"` (raw AXTree) remain completely supported and backward-compatible.

---

## Critical User Journeys (CUJs)

### CUJ 1: Low-Token Form Automation
*   **Context**: An AI assistant in Claude Code or Antigravity is instructed to log into a developer dashboard and fill out an issue form.
*   **Action**: The agent calls `browser_get_page_content({ format: "interactive" })`.
*   **Result**: It receives a 600-token semantic list of interactive controls with handles `[e1]` through `[e12]`. It fills `[e2]` (username) and `[e3]` (password) and clicks `[e4]` (submit) directly without guessing CSS selectors or blowing its context.

### CUJ 2: Heavy Dashboard Navigation with Context Shield
*   **Context**: An agent navigates to an analytics dashboard displaying a table with 500 rows.
*   **Action**: The agent calls `browser_get_page_content({ format: "interactive" })`.
*   **Result**: The server detects that the payload exceeds 2,500 tokens. It spools the full tree to `~/.browser-mcp/snapshots/tab_2.txt` and returns a 180-token summary: table dimensions, page title, 5 primary action buttons, and a hint to use `browser_search_elements` or read the snapshot file directly.

### CUJ 3: Multi-Step Wizard with Delta Streaming
*   **Context**: An agent progresses through a 4-step configuration wizard.
*   **Action**: The agent requests updates via `browser_get_page_content({ format: "delta" })`.
*   **Result**: Instead of re-ingesting 2,000 tokens on each step, it receives only a 150-token delta describing newly opened modal dialogs and active wizard steps.


--------------------------------------------------------------------------------

## Technical Plan

### System Architecture Pipeline

```text
┌────────────────────────────────────────────────────────┐
│             AI Agent Client (Claude / Cursor)          │
└───────────────────────────┬────────────────────────────┘
                            │ (stdio JSON-RPC 2.0)
┌───────────────────────────▼────────────────────────────┐
│   Browser MCP Native Host Engine (Rust / browser-mcp)  │
│                                                        │
│   ┌────────────────────┐      ┌────────────────────┐   │
│   │   Shield Guard     │      │   Delta Engine     │   │
│   │ (Threshold > 2500) │      │ (SHA-256 State Map)│   │
│   └─────────┬──────────┘      └─────────┬──────────┘   │
│             │                           │              │
│   ┌─────────▼───────────────────────────▼──────────┐   │
│   │   Spooler: ~/.browser-mcp/snapshots/tab_X.txt  │   │
│   └────────────────────────────────────────────────┘   │
└───────────────────────────┬────────────────────────────┘
                            │ (WebSocket loopback ws://127.0.0.1:9876)
┌───────────────────────────▼────────────────────────────┐
│      Brave / Chrome Extension (MV2 Background Bridge)   │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │   Interactive Semantic Distiller               │   │
│   │   • Queries CDP Accessibility.getFullAXTree    │   │
│   │   • Whitelists Actionable Roles (button, input)│   │
│   │   • Strips Empty Wrappers, Generic Containers  │   │
│   │   • Assigns Monotonic Handles: [e1], [e2]...   │   │
│   │   • Computes Normalized Viewport Bounding Box  │   │
│   └───────────────────────┬────────────────────────┘   │
│                           │                            │
│   ┌───────────────────────▼────────────────────────┐   │
│   │   Targeted Element Searcher                    │   │
│   │   (Sub-100 token query by text, role, or label)│   │
│   └───────────────────────┬────────────────────────┘   │
└───────────────────────────┼────────────────────────────┘
                            │ (CDP Hardware Events & Queries)
┌───────────────────────────▼────────────────────────────┐
│                 Live Chrome / Brave Tabs               │
└────────────────────────────────────────────────────────┘
```

### Component Breakdown & Responsibilities

#### 1. Interactive Semantic Distiller (`extension/src/dom-inspector.js`)
- Queries Chrome DevTools Protocol `Accessibility.getFullAXTree`.
- Traverses nodes recursively and filters against actionable interactive roles:
  - Whitelisted Roles: `button`, `link`, `textbox`, `searchbox`, `checkbox`, `radio`, `combobox`, `listbox`, `menuitem`, `tab`, `dialog`, `switch`, `slider`, `treeitem`.
  - Alert Roles: `alert`, `alertdialog`, `status`, `tooltip` (preserves crucial feedback banners and validation error messages).
  - Pruned / Discarded: `generic`, `group`, `none`, unlabelled layout containers, static text nodes with no interactive ancestors, decorative SVGs.
- Computes normalized bounding boxes `(x: float, y: float)` relative to the viewport.
- Generates monotonic sequential element handles (`[e1]`, `[e2]`, ...) and maintains an active session map `tabElementMaps.get(tabId)`.
- Translates handles back to CDP `backendNodeId` so that interaction tools (`browser_click("e1")`, `browser_fill("e2", "...")`) execute without DOM selector ambiguity.

#### 2. Targeted Element Search (`extension/background.js`)
- Exposes `browser_search_elements` tool handler.
- Accepts parameters: `query` (text substring or regex), `role` (optional ARIA role), `tab_id` (optional).
- Scans the distilled active element map and returns only matching elements (maximum 5) with immediate ancestor context:
  ```json
  {
    "matches": [
      { "handle": "e14", "role": "button", "name": "Submit Order", "rect": { "x": 0.82, "y": 0.91 } }
    ],
    "count": 1
  }
  ```
- Keeps agent context consumption below 100 tokens per search.

#### 3. Context Shield & Out-of-Band Spooling (`crates/browser-mcp-server/src/shield.rs`)
- Sits between the WebSocket bridge reader and standard I/O response serializer in Rust.
- Evaluates response character count (heuristic: 1 token ≈ 4 characters).
- If an inspection payload exceeds 2,500 tokens (10,000 characters):
  1. Writes the full distilled payload to `~/.browser-mcp/snapshots/tab_<id>_<timestamp>.txt`.
  2. Synthesizes a compact summary envelope:
     - Document Title & URL.
     - Total element count by role (e.g., "12 buttons, 4 textboxes, 18 links").
     - Top 10 prominent action items.
     - Spool path link: `Full snapshot written to: ~/.browser-mcp/snapshots/tab_1_1730440000.txt`.
     - Guidance note: `"Use browser_search_elements to locate specific items without loading the full snapshot."`
- Implements an LRU cache cleaner retaining at most 50 snapshot files (max 50 MB total storage).

#### 4. Incremental State Delta Engine (`crates/browser-mcp-server/src/delta.rs`)
- Tracks per-tab element snapshots as keyed string maps: `BTreeMap<String, ElementNode>`.
- When an agent specifies `format="delta"` in `browser_get_page_content`:
  - Computes symmetric difference against the tab's previous turn.
  - Outputs concise line-based mutations:
    - `+ [e22] dialog "Confirm Payment" [opened]`
    - `~ [e5] textbox "Quantity" value="3"`
    - `- [e12] button "Add to Cart" [hidden]`
  - If no prior state exists or page navigated to a new origin, transparently falls back to a full clean interactive snapshot.

### API & Schema Modifications

#### Tool: `browser_get_page_content`
Updated parameters:
- `format`: Enum `["raw", "text", "snapshot", "interactive", "delta"]` (Default: `"interactive"`).
- `max_tokens`: Optional integer (Default: `2500`). When exceeded, Context Shield triggers automatically.
- `interactive_only`: Optional boolean (Default: `true` for `"interactive"` mode).

#### Tool: `browser_search_elements` (New Tool)
Parameters:
- `query`: String (Required). Target label, button text, or placeholder to match.
- `role`: String (Optional). Filter by role (`button`, `textbox`, `link`, etc.).
- `tab_id`: Integer (Optional). Target specific tab ID (defaults to active session tab).

### Invariants & Safety Constraints
- `[shield:safe-limit]`: Context Shield must prevent tool output strings over 2,500 tokens from being dumped directly into client stdio unless explicitly requested via `max_tokens: 0`.
- `[ref:monotonic-session]`: Reference handles (`[e1]`, `[e2]`) assigned during a turn remain immutable until the next page navigation or full refresh.
- `[fallback:clean-state]`: If state delta computation encounters an unrecognized target ID or navigation hash mismatch, it must return a full clean snapshot rather than partial or corrupted diffs.
- `[storage:lru-pruning]`: Snapshot files in `~/.browser-mcp/snapshots/` must not exceed 50 MB total disk quota.


--------------------------------------------------------------------------------

## Alternatives Considered

### 1. Raw HTML DOM Sanitization in Rust Host
- **Proposed Mechanism**: Have the extension dump raw HTML (`document.documentElement.outerHTML`) to the Rust engine, and run an HTML parser crate (`scraper` or `html5ever`) with regular expressions to strip `<script>`, `<style>`, and empty `<div>` tags.
- **Why Rejected**:
  - *Blind to Computed Visibility*: An HTML string dump cannot detect whether an element is visually hidden via CSS (`display: none`, `visibility: hidden`, offscreen coordinates, or `opacity: 0`). The agent would repeatedly attempt to click invisible or collapsed elements.
  - *Ignores Shadow DOM*: Modern web apps (e.g. YouTube, Salesforce, Lit components) heavily utilize shadow roots that raw `outerHTML` fails to traverse.
  - *Binary Bloat*: Linking heavy HTML and CSS parsing libraries into the Rust binary increases binary size and compile times without improving accuracy. Chrome DevTools Protocol (`Accessibility.getFullAXTree`) already resolves computed accessibility, visibility, and shadow roots natively in the browser engine.

### 2. Pure Vision-Based Grounding (Screenshots + Coordinate Grids)
- **Proposed Mechanism**: Discard DOM and accessibility trees entirely; take high-resolution screenshots after every turn and prompt the LLM to output pixel coordinates `(x, y)` for mouse actions.
- **Why Rejected**:
  - *Severe Token and Financial Cost*: Multimodal image tokens are drastically more expensive than text tokens (often 1,500–2,000 tokens per high-res screenshot), making multi-turn workflows economically unsustainable.
  - *Coordinate Drift & Precision Errors*: Vision models frequently miscalculate coordinates by 10–20 pixels, missing small icon buttons, checkbox targets, and compact table pagination controls.
  - *No Text Selection or Input Value Verification*: Screenshots cannot provide exact string values inside input fields without running OCR, whereas accessibility trees provide deterministic `value="..."` states directly.

### 3. Headless Browser Automation (Playwright / Puppeteer Architecture)
- **Proposed Mechanism**: Spawn a headless browser instance in the background using Playwright or Puppeteer.
- **Why Rejected**:
  - *Cloudflare & Bot-Detection Blocks*: Headless browsers are actively flagged and challenged by Cloudflare Turnstile, Akamai, and modern bot-management platforms.
  - *Loss of Authenticated Sessions*: Headless browsers start with clean, unauthenticated profiles, requiring complex credential handoffs and 2FA bypass scripts. Browser MCP's core design advantage is operating inside the user's real, daily authenticated Brave/Chrome browser.
  - *Runtime Overhead*: Requires a heavyweight Node.js or Python runtime, defeating the single 3 MB static binary architecture.

### 4. Exclusive Reliance on WebMCP / Client-Side Tool Registration
- **Proposed Mechanism**: Wait for web applications to expose their own tool declarations via client-side JavaScript APIs (such as `navigator.modelContext.registerTool`).
- **Why Rejected**:
  - *Ecosystem Immaturity*: Virtually no production websites or internal SaaS dashboards support WebMCP today. Browser MCP must reliably automate existing arbitrary enterprise and consumer web applications immediately.


--------------------------------------------------------------------------------

## Detailed Implementation Plan

### Complete File Enumeration & Modification Rationales

1. [`extension/src/dom-inspector.js`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/src/dom-inspector.js) *(Modified)*
   - **Rationale**: Implements the core interactive tree distillation algorithm. Traverses `Accessibility.getFullAXTree` CDP nodes recursively, filters out layout containers and non-interactive wrappers, assigns monotonic handles (`[e1]`, `[e2]`, ...), computes normalized viewport bounding boxes, and stores the handle-to-node mapping in `tabElementMaps`.

2. [`extension/background.js`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/background.js) *(Modified)*
   - **Rationale**: Wires the new distillation pipeline into the WebSocket bridge. Updates `browser_get_page_content` to handle `format="interactive"` and `format="delta"`. Implements `browser_search_elements` dispatch. Modifies `browser_click`, `browser_fill`, and `browser_hover` to resolve element handle strings (`"e1"`) directly to CDP `backendNodeId` via `DOM.resolveNode`.

3. [`crates/browser-mcp-server/src/shield.rs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/crates/browser-mcp-server/src/shield.rs) *(New File)*
   - **Rationale**: Implements the Context Shield in Rust. Evaluates outgoing tool response sizes against a configurable token threshold (default: 2,500 tokens). If exceeded, spools the complete representation to `~/.browser-mcp/snapshots/tab_<id>_<timestamp>.txt`, generates an ultra-compact summary index, and enforces an LRU retention cap (max 50 files / 50 MB).

4. [`crates/browser-mcp-server/src/delta.rs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/crates/browser-mcp-server/src/delta.rs) *(New File)*
   - **Rationale**: Implements the in-memory state delta engine in Rust. Caches tab element maps and computes concise line-based mutation diffs (`+ Added`, `- Removed`, `~ Mutated`) when `format="delta"` is requested.

5. [`crates/browser-mcp-server/src/lib.rs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/crates/browser-mcp-server/src/lib.rs) *(Modified)*
   - **Rationale**: Exports `shield` and `delta` modules for unit and integration testing.

6. [`crates/browser-mcp-server/src/main.rs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/crates/browser-mcp-server/src/main.rs) *(Modified)*
   - **Rationale**: Integrates `ContextShield` and `DeltaEngine` into the main stdio dispatch loop, filtering `browser_get_page_content` and `browser_search_elements` responses before serialization.

7. [`crates/browser-mcp-server/src/tools.rs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/crates/browser-mcp-server/src/tools.rs) *(Modified)*
   - **Rationale**: Registers `browser_search_elements` in `METHOD_MAP` to route to the extension bridge.

8. [`crates/browser-mcp-server/tools_schema.json`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/crates/browser-mcp-server/tools_schema.json) *(Modified)*
   - **Rationale**: Expands `browser_get_page_content` parameters to include `"interactive"` and `"delta"` formats, and adds the formal schema definition for the new `browser_search_elements` tool (incrementing total tool count from 40 to 41).

9. [`crates/browser-mcp-server/tests/bridge_test.rs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/crates/browser-mcp-server/tests/bridge_test.rs) *(Modified)*
   - **Rationale**: Adds automated native Rust integration tests covering schema count (41 tools), `ContextShield` threshold spooling, `DeltaEngine` state diffing, and element handle resolution.

10. [`scripts/check-docs.py`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/check-docs.py) *(Modified)*
    - **Rationale**: Updates the CI documentation quality gate assertion to verify 41 active tools across documentation and schemas.

11. [`scripts/generate-docs.py`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/generate-docs.py) *(Modified)*
    - **Rationale**: Updates the static documentation generator to generate reference documentation for `browser_search_elements` and interactive distillation parameters.

12. [`README.md`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/README.md) *(Modified)*
    - **Rationale**: Updates the tool catalog table, system overview, and feature highlights to reflect 41 tools and v2.2 token-efficiency capabilities.

13. [`crates/browser-mcp-server/src/README.md`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/crates/browser-mcp-server/src/README.md) *(Modified)*
    - **Rationale**: Synchronizes the EGM architecture contract for `src/` to document the new `shield.rs` and `delta.rs` module interfaces and invariants.

### Phased Execution Sequence

#### Phase 1: Interactive Semantic Distiller (`extension/src/dom-inspector.js` & `background.js`)
1. Implement recursive tree walker filtering `Accessibility.getFullAXTree` against actionable roles (`button`, `textbox`, `link`, `combobox`, `dialog`, etc.).
2. Assign sequential handles (`[e1]`, `[e2]`) and normalized bounding coordinates.
3. Map handles to CDP `backendNodeId` in `tabElementMaps`.
4. Update `browser_click`, `browser_fill`, and `browser_hover` to accept element handles directly.

#### Phase 2: Targeted Element Search (`browser_search_elements`)
1. Implement `browser_search_elements` in `extension/background.js`.
2. Register tool in `crates/browser-mcp-server/tools_schema.json` and `tools.rs`.
3. Verify sub-100 token response output against test pages.

#### Phase 3: Context Shield Subsystem (`crates/browser-mcp-server/src/shield.rs`)
1. Create `shield.rs` in Rust server with token heuristic counter and file spooler.
2. Intercept responses exceeding 2,500 tokens, spool to `~/.browser-mcp/snapshots/tab_<id>_<timestamp>.txt`, and emit concise summary envelopes.
3. Implement 50-file / 50 MB LRU disk retention cleaner.

#### Phase 4: State Delta Streaming (`crates/browser-mcp-server/src/delta.rs`)
1. Create `delta.rs` in Rust server tracking per-tab element state maps.
2. Implement symmetric diff engine emitting line-based `+ Added`, `- Removed`, `~ Mutated` nodes for `format="delta"`.
3. Implement clean fallback on origin navigation or target ID mismatch.

#### Phase 5: Verification & Quality Gates
1. Run `cargo test --manifest-path crates/browser-mcp-server/Cargo.toml` to verify all Rust tests.
2. Run `node scripts/build-extension.mjs` to validate extension syntax and update `~/.browser-mcp/extension/`.
3. Run `python scripts/generate-docs.py` and `python scripts/check-docs.py` to ensure docs gate is green.
4. Verify live interactive execution against Brave browser.
