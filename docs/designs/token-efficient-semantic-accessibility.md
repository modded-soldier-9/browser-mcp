# Browser MCP v2.2 — Token-Efficient Semantic Accessibility & Context Shield

*   **Author:** Mohamed Elsheikh ([@modded-soldier-9](https://github.com/modded-soldier-9))
*   **Status:** Approved & Remediated
*   **Date:** 2026-11-01
*   **Predecessor Document:** [concepts_brief.md](../../concepts_brief.md)

---

## Overview

Browser MCP v2.2 expands the standalone Rust browser automation engine with an interactive semantic accessibility pipeline and context protection subsystem. While v2.1.0 stabilized the zero-dependency native Rust binary and Manifest V2 WebSocket bridge, multi-step browser interactions still suffer from context window degradation: modern web applications routinely deliver 25,000 to 50,000 tokens of raw DOM and verbose accessibility trees on every page inspection.

This design introduces four integrated capabilities:
1. **Interactive Semantic Distillation (`format="interactive"`)**: Prunes non-actionable layout wrappers (`div`, `span`, purely decorative styling containers) by extending the existing `generateAriaSnapshot` engine in `extension/background.js`. Reduces standard page representations to 400–1,200 tokens with persistent reference handles (`[e1]`, `[e2]`) anchored to CDP `backendNodeId`.
2. **Context Shield & Out-of-Band Spooling**: Automatically intercepts large payloads exceeding 2,500 tokens in the Rust engine, stores full representations to local disk (`~/.browser-mcp/snapshots/`), and returns a compact summary index with in-band pagination (`page_offset`, `limit`) to protect LLM context windows.
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
2. **Deterministic Monotonic Element Handles**: Assign sequential element references (`[e1]`, `[e2]`, ...) anchored to CDP `backendNodeId` that map directly to native DOM/CDP nodes across interaction tools (`browser_click`, `browser_fill`, `browser_hover`) using coordinate-based trusted dispatch.
3. **Context Shield Protection**: Automatically divert inspection payloads exceeding 2,500 tokens to `~/.browser-mcp/snapshots/tab_<id>.txt`, returning a concise summary index and in-band pagination controls.
4. **Targeted Sub-100 Token Search**: Provide `browser_search_elements` to find specific targets by role, name, or text in under 100 tokens.
5. **Incremental State Mutation Streaming**: Provide an opt-in `format="delta"` mode emitting only added, removed, or updated interactive elements following actions.
6. **Zero External Runtime Footprint**: Execute all parsing, pruning, and spooling logic strictly within the compiled Rust host binary and Manifest V2 extension; zero external Node.js dependencies.

---

## Non-Goals

1. **Full-Page Visual Layout Reconstruction**: The interactive semantic snapshot is designed for agent action execution, not pixel-perfect visual reproduction.
2. **Client-Side Heavy Parsing Crates**: Large DOM parsing libraries (such as `scraper` or `html5ever`) will not be linked into the Rust binary; structural filtering is handled natively in the browser extension's CDP pipeline.
3. **Automatic Task Execution / Autonomous Loops**: Browser MCP remains an MCP server providing tools to AI client agents; it does not run autonomous goal-seeking agent loops itself.
4. **Breaking Changes to Existing Tools**: `format="html"` and `format="snapshot"` (raw AXTree) remain backward-compatible.

---

## Critical User Journeys (CUJs)

### CUJ 1: Low-Token Form Automation
*   **Context**: An AI assistant in Claude Code or Antigravity is instructed to log into a developer dashboard and fill out an issue form.
*   **Action**: The agent calls `browser_get_page_content({ format: "interactive" })`.
*   **Result**: It receives a 600-token semantic list of interactive controls with handles `[e1]` through `[e12]`. It fills `[e2]` (username) and `[e3]` (password) and clicks `[e4]` (submit) directly without guessing CSS selectors or exceeding context limits.

### CUJ 2: Heavy Dashboard Navigation with Context Shield
*   **Context**: An agent navigates to an analytics dashboard displaying a table with 500 rows.
*   **Action**: The agent calls `browser_get_page_content({ format: "interactive" })`.
*   **Result**: The server detects that the payload exceeds 2,500 tokens. It spools the full tree to `~/.browser-mcp/snapshots/tab_2_<timestamp>.txt` and returns a 180-token summary: table dimensions, page title, 5 primary action buttons, and in-band pagination handles (`page_offset: 0, limit: 50`).

### CUJ 3: Multi-Step Wizard with Delta Streaming
*   **Context**: An agent progresses through a 4-step configuration wizard.
*   **Action**: The agent requests updates via `browser_get_page_content({ format: "delta" })`.
*   **Result**: Instead of re-ingesting 2,000 tokens on each step, it receives only a 150-token delta describing newly opened modal dialogs and active wizard steps.

---

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
│   │   ContextShield    │      │   DeltaEngine      │   │
│   │ (Threshold > 2500) │      │ (Symmetric Diff)   │   │
│   └─────────┬──────────┘      └─────────┬──────────┘   │
│             │                           │              │
│   ┌─────────▼───────────────────────────▼──────────┐   │
│   │   Spooler: ~/.browser-mcp/snapshots/tab_X.txt  │   │
│   │   In-Band Pagination: page_offset & limit      │   │
│   └────────────────────────────────────────────────┘   │
└───────────────────────────┬────────────────────────────┘
                            │ (WebSocket loopback ws://127.0.0.1:9876)
                            │ Payload: { tab_id, content, elements, url, title }
┌───────────────────────────▼────────────────────────────┐
│      Brave / Chrome Extension (MV2 background.js)      │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │   Interactive Semantic Distiller               │   │
│   │   • Extends generateAriaSnapshot (L3859-L4012) │   │
│   │   • Whitelists Actionable Roles (button, input)│   │
│   │   • Persistent Map<backendNodeId, handle>      │   │
│   │   • Resolves to Viewport Coordinates (x, y)    │   │
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

#### 1. Interactive Semantic Distiller (`extension/background.js`)
- Reuses and extends existing `generateAriaSnapshot` (lines 3859–4012).
- Traverses nodes recursively and filters against actionable interactive roles:
  - Whitelisted Roles: `button`, `link`, `textbox`, `searchbox`, `checkbox`, `radio`, `combobox`, `listbox`, `menuitem`, `tab`, `dialog`, `switch`, `slider`, `treeitem`.
  - Alert Roles: `alert`, `alertdialog`, `status`, `tooltip` (preserves system feedback banners and validation error messages).
  - Pruned / Discarded: `generic`, `group`, `none`, unlabelled layout containers, static text nodes with no interactive ancestors, decorative SVGs.
- Maintains `tabElementMaps`: a persistent session map `Map<number, Map<number, string>>` indexing `tabId -> Map<backendNodeId, handle>`.
- Monotonic Handle Assignment: When an element is discovered, it checks if `backendNodeId` already has an assigned handle. Existing handles never shift; new elements receive `e(maxId + 1)`.
- Coordinate-Based Trusted Mouse Dispatch: Interacting with handle `e1` invokes `resolveElement(tabId, 'e1')` which returns `{ x, y }` viewport coordinates, driving `Input.dispatchMouseEvent` to generate `isTrusted=true` hardware events.

#### 2. Targeted Element Search (`extension/background.js`)
- Exposes `browser_search_elements` tool handler in the `dispatch()` switch block.
- Accepts parameters: `query` (case-insensitive substring), `role` (optional ARIA role), `tab_id` (optional).
- Scans `window.__bmcpElements` on the target tab and returns up to 5 matching elements with their handle, role, text name, and viewport coordinates.
- Keeps agent context consumption below 100 tokens per search.

#### 3. Context Shield & Out-of-Band Spooling (`crates/browser-mcp-server/src/shield.rs`)
- Implements `ContextShield` struct in Rust.
```rust
pub struct ContextShield {
    pub max_tokens: usize,
    pub snapshot_dir: PathBuf,
}

impl ContextShield {
    pub fn new() -> Self;
    pub fn evaluate_and_spool(&self, tab_id: u32, content: &str, page_offset: usize, limit: usize) -> String;
    pub fn prune_lru(&self, max_files: usize, max_bytes: u64) -> Result<(), std::io::Error>;
}
```
- When an inspection payload exceeds `max_tokens` (default 2,500 tokens):
  1. Spools the complete content to `~/.browser-mcp/snapshots/tab_<id>_<timestamp>.txt`.
  2. If `page_offset` and `limit` are supplied, slices the lines directly for in-band pagination.
  3. Returns a compact summary envelope with document title, URL, element count by role, top 10 elements in document order, and direct file path.
- Enforces LRU disk retention (maximum 50 files or 50 MB total quota).

#### 4. Incremental State Delta Engine (`crates/browser-mcp-server/src/delta.rs`)
- Implements `DeltaEngine` in Rust tracking previous line snapshots per tab:
```rust
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ElementSnapshot {
    pub url: String,
    pub title: String,
    pub raw_lines: Vec<String>,
}

#[derive(Default)]
pub struct DeltaEngine {
    tab_cache: std::collections::HashMap<u32, ElementSnapshot>,
}

impl DeltaEngine {
    pub fn compute_delta(&mut self, tab_id: u32, current: ElementSnapshot) -> String;
    pub fn clear_tab(&mut self, tab_id: u32);
}
```
- Performs symmetric line diffing:
  - Lines present only in `current` are emitted as `+ [eX] ...`
  - Lines present only in `previous` are emitted as `- [eX] ...`
  - Elements with altered values emit `~ [eX] ...`
- If navigation occurs (URL origin mismatch), `DeltaEngine` automatically resets cache and emits a full snapshot.

---

### API & Schema Modifications

#### Tool: `browser_get_page_content`

| Parameter | Type | Default / Required | Description |
| :--- | :--- | :--- | :--- |
| `format` | string | `"interactive"` (Optional) | Content representation: `"interactive"`, `"snapshot"`, `"html"`, `"text"`, `"delta"`. |
| `max_tokens` | integer | `2500` (Optional) | Token threshold before Context Shield triggers out-of-band spooling. Set `0` to disable. |
| `page_offset` | integer | `0` (Optional) | Pagination line offset when retrieving large spooled snapshots in-band. |
| `limit` | integer | `100` (Optional) | Maximum lines to return per paginated slice. |
| `selector` | string | `null` (Optional) | CSS/Handle selector to scope inspection to a specific container subtree. |

#### Tool: `browser_search_elements` (New Tool)

| Parameter | Type | Default / Required | Description |
| :--- | :--- | :--- | :--- |
| `query` | string | **Required** | Case-insensitive text substring, label, button text, or placeholder to match. |
| `role` | string | `null` (Optional) | ARIA role filter (`button`, `textbox`, `link`, `combobox`, `dialog`). |
| `tab_id` | integer | `null` (Optional) | Target tab ID (defaults to active session tab). |

---

## Security & Privacy Considerations

1. **Local Snapshot File Permissions (`0600`)**: Spooled snapshots written to `~/.browser-mcp/snapshots/` may contain sensitive dashboard text or session state. On POSIX systems, files are created with mode `0600` (read/write by owner only); on Windows, files reside within the authenticated user's profile directory (`%USERPROFILE%\.browser-mcp\snapshots`).
2. **Password Field Redaction**: Input fields with role `textbox` and `protected` / `type="password"` attribute must never spool or emit typed values in cleartext; values are masked as `[protected]`.
3. **Loopback Origin Isolation**: Snapshots are strictly scoped per tab ID and origin. WebSocket commands requesting elements or search queries enforce the existing `Origin: chrome-extension://[a-p]{32}` security boundary.
4. **LRU Storage Bounds**: To prevent disk exhaustion attacks, the Context Shield enforces an automatic LRU sweeper capping total snapshot disk usage at 50 MB (maximum 50 files).

---

## Alternatives Considered

| Approach | Token Overhead | Interaction Precision | Auth / Session Support | Complexity | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Native Distillation (Selected)** | **Low** (<1,200 tokens) | **High** (Deterministic `[e1]` handles) | **Full** (Real authenticated profile) | **Minimal** (Reuses `generateAriaSnapshot`) | **Adopted** |
| **Raw HTML Parsing in Rust** | High (10k–30k tokens) | Poor (Blind to CSS visibility) | Full (Real authenticated profile) | High (Heavy HTML parser crates) | Rejected |
| **Pure Vision Grounding** | Very High (1.5k–2k tokens/step)| Medium (10–20px drift) | Full (Real authenticated profile) | Medium (High latency & token cost) | Rejected |
| **Headless Playwright / Puppeteer** | Medium (5k–15k tokens) | High (Locators & AX) | None (Requires re-auth & bot walls) | High (Node.js/Python dependency) | Rejected |
| **Client-Side WebMCP Only** | Very Low (<200 tokens) | High (Native functions) | Full (Application-provided) | N/A (Unsupported on 99.9% of web) | Rejected |

---

## Detailed Implementation Plan

### Complete File Enumeration & Modification Rationales

1. [`extension/background.js`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/extension/background.js) *(Modified)*
   - **Rationale**: Core extension implementation. Extends `generateAriaSnapshot` (lines 3859–4012) to support `format="interactive"`, establishes persistent `tabElementMaps` keyed by `backendNodeId` for monotonic `[e1]` handles, includes `tab_id: tab.id` in `get_page_content` response envelopes, and implements the `search_elements` dispatch handler.

2. [`crates/browser-mcp-server/src/shield.rs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/crates/browser-mcp-server/src/shield.rs) *(New File)*
   - **Rationale**: Implements `ContextShield` in Rust. Evaluates outgoing payload size, spools payloads > 2,500 tokens to `~/.browser-mcp/snapshots/tab_<id>_<timestamp>.txt`, provides in-band line slicing (`page_offset`, `limit`), and enforces 50 MB LRU disk retention.

3. [`crates/browser-mcp-server/src/delta.rs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/crates/browser-mcp-server/src/delta.rs) *(New File)*
   - **Rationale**: Implements `DeltaEngine` in Rust. Stores per-tab `ElementSnapshot` history and computes line-based symmetric mutation diffs (`+ Added`, `- Removed`, `~ Mutated`) for `format="delta"`.

4. [`crates/browser-mcp-server/src/lib.rs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/crates/browser-mcp-server/src/lib.rs) *(Modified)*
   - **Rationale**: Exports `shield` and `delta` modules for unit and integration testing.

5. [`crates/browser-mcp-server/src/main.rs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/crates/browser-mcp-server/src/main.rs) *(Modified)*
   - **Rationale**: Plumbs thread-safe shared references (`Arc<tokio::sync::Mutex<DeltaEngine>>` and `Arc<ContextShield>`) through the async stdio request handler.

6. [`crates/browser-mcp-server/src/tools.rs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/crates/browser-mcp-server/src/tools.rs) *(Modified)*
   - **Rationale**: Registers `"browser_search_elements": "search_elements"` in `METHOD_MAP`.

7. [`crates/browser-mcp-server/tools_schema.json`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/crates/browser-mcp-server/tools_schema.json) *(Modified)*
   - **Rationale**: Expands `browser_get_page_content` format enum with `"interactive"` and `"delta"`, adds `page_offset` and `limit`, and adds the definition for `browser_search_elements` (updating tool count from 40 to 41).

8. [`crates/browser-mcp-server/tests/bridge_test.rs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/crates/browser-mcp-server/tests/bridge_test.rs) *(Modified)*
   - **Rationale**: Updates tool count assertions to 41, and adds pure Rust integration tests for `ContextShield` spooling/LRU eviction and `DeltaEngine` symmetric diff calculation.

9. [`scripts/generate-docs.py`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/generate-docs.py) *(Modified)*
   - **Rationale**: Generates updated reference documentation for the 41-tool surface and interactive distillation parameters.

10. [`scripts/check-docs.py`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/check-docs.py) *(Modified)*
    - **Rationale**: Verifies dynamic tool counts and claims across documentation.

11. [`README.md`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/README.md) *(Modified)*
    - **Rationale**: Updates the tool table and overview to reflect 41 tools and v2.2 token-efficiency capabilities.

12. [`crates/browser-mcp-server/src/README.md`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/crates/browser-mcp-server/src/README.md) *(Modified)*
    - **Rationale**: Updates EGM architectural contract for `src/` to document `shield.rs` and `delta.rs`.

---

### Phased Execution Sequence

#### Phase 1: Extension Semantic Distiller & Monotonic Handles (`extension/background.js`)
1. Extend `generateAriaSnapshot` to handle `format="interactive"`.
2. Anchor handle allocation in `tabElementMaps` keyed by `backendNodeId` to prevent handle shifting.
3. Include `tab_id: tab.id` in `get_page_content` response envelopes.
4. Verify handle coordinate resolution in `resolveElement()`.

#### Phase 2: Targeted Element Search Tool (`browser_search_elements`)
1. Implement `search_elements` dispatch in `extension/background.js`.
2. Register tool in `crates/browser-mcp-server/tools_schema.json` and `tools.rs`.

#### Phase 3: Rust Context Shield Subsystem (`crates/browser-mcp-server/src/shield.rs`)
1. Implement `ContextShield` struct with token counting, spooling to `~/.browser-mcp/snapshots/`, and in-band pagination.
2. Implement 50 MB / 50 file LRU disk cleaner.
3. Add unit tests in `shield.rs`.

#### Phase 4: Rust State Delta Engine (`crates/browser-mcp-server/src/delta.rs`)
1. Implement `DeltaEngine` struct in Rust with per-tab `ElementSnapshot` history.
2. Implement line diffing for `format="delta"`.
3. Add unit tests in `delta.rs`.

#### Phase 5: Verification & Release Deployment
1. Plumb `ContextShield` and `DeltaEngine` into `crates/browser-mcp-server/src/main.rs`.
2. Run `cargo test --manifest-path crates/browser-mcp-server/Cargo.toml` (all tests passing).
3. Run `node scripts/build-extension.mjs` (syntax checks passing, synced to `~/.browser-mcp/extension`).
4. Run `python scripts/generate-docs.py` and `python scripts/check-docs.py` (docs gate green).
5. Compile release binary and test live against Brave browser.
