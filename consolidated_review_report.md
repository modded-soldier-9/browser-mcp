# Consolidated Review Report: Browser MCP v2.2

**Document Under Review**: [`docs/designs/token-efficient-semantic-accessibility.md`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/docs/designs/token-efficient-semantic-accessibility.md)  
**Overall Status**: **REVISE**  
**Review Synthesis**: 7 Goldfish Lenses Consolidated across 5 Review Stages.

---

## Executive Summary

The Goldfish Review Protocol completed all five review stages in uninterrupted mode. The core motivation—reducing per-interaction token consumption from 35,000 to <1,200 tokens via semantic accessibility trees—is universally affirmed. However, the initial draft proposed disconnected module boundaries (`extension/src/dom-inspector.js` in a non-module MV2 runtime), unstable handle shifting, and missing Rust data contracts. 

The remediation path is concrete: extend existing `generateAriaSnapshot` and `resolveElement` directly in `extension/background.js`, preserve trusted coordinate mouse dispatch, anchor handles to CDP `backendNodeId`, define Rust struct contracts, and add in-band pagination for Context Shield.

---

## Traceability Matrix

| Finding ID | Priority | Description | Source Lens | Resolution Status |
| :--- | :--- | :--- | :--- | :--- |
| **B1** | 🔴 Blocker | Consolidate distillation into `extension/background.js` (MV2 runtime compatibility) | Zoom Out, Implementation, Codebase Details | Target `extension/background.js` directly |
| **B2** | 🔴 Blocker | Preserve coordinate-based mouse dispatch instead of `DOM.resolveNode` | Codebase Details, Implementation | Retain `resolveElement()` for trusted events |
| **B3** | 🔴 Blocker | Anchor element handles to CDP `backendNodeId` to prevent turn-by-turn index shifting | Design, Comprehension | Monotonic session map keyed by `backendNodeId` |
| **B4** | 🔴 Blocker | Define Rust data contracts for `shield.rs` and `delta.rs`, and add `tab_id` to bridge response | Implementation, Comprehension, Codebase Details | Add concrete struct definitions & `tab_id` |
| **M1** | 🟡 Major | Add in-band MCP pagination for Context Shield to support remote agents | Design, Comprehension | Add `page_offset` and `limit` parameters |
| **M2** | 🟡 Major | Format schema parameters as Markdown tables and add `Security & Privacy Considerations` | Structural | Add parameter tables & security section |
| **M3** | 🟡 Major | Add 5-column tradeoff comparison matrix in Alternatives Considered | Structural | Insert tradeoff evaluation table |
| **M4** | 🟡 Major | Reassign CI tool count test assertions to `tests/bridge_test.rs` and update `content/*.md` | Codebase Details | Update test file assertions and doc claims |
| **N1** | 🟢 Nit | Replace informal slang and promotional modifiers with objective technical prose | Style | Apply editorial refinements |
| **N2** | 🟢 Nit | Standardize horizontal rules to `---` and fix `format="raw"` to `format="html"` | Structural, Comprehension | Normalize delimiters and parameter names |

---

## Prioritized Action Items

### 🔴 Blockers (Immediate Architectural Corrections)
1. **Consolidate Extension Distillation in `background.js`**: Update Section 3.1 and Section 5 to target `extension/background.js` (extending existing `generateAriaSnapshot` lines 3859–4012), removing references to `extension/src/dom-inspector.js`.
2. **Retain Coordinate-Based Trusted Dispatch**: Update Section 3.1 and Section 5 to resolve element handles (`"e1"`) to bounding centers `{ x, y }` via `resolveElement()`, preserving `isTrusted=true` hardware mouse events for `browser_click` and `browser_hover`.
3. **Establish Monotonic Handle Session Table**: Specify that element handles are keyed by CDP `backendNodeId` in `tabElementMaps`, incrementing monotonically without shifting existing handles when new DOM nodes appear.
4. **Define Rust Struct Contracts & `tab_id` Payload**: Specify `ElementSnapshot` and `ContextShield` struct definitions, and update `get_page_content` response payload to include `tab_id: tab.id`.

### 🟡 Majors (Contract Precision & Accessibility Safety)
5. **Add In-Band MCP Pagination**: Extend `browser_get_page_content` parameters to include `page_offset` and `limit`, allowing remote agents to paginate through large snapshots.
6. **Add Schema Tables & Security Section**: Reformat parameter lists into structured Markdown tables and insert `## Security & Privacy Considerations` specifying file permissions (`0600`) and loopback scoping for `~/.browser-mcp/snapshots/`.
7. **Add Alternatives Evaluation Matrix**: Insert a 5-column comparison table in `## Alternatives Considered`.
8. **Update CI Test Assertions**: Correct the implementation plan to update `assert_eq!(tools.len(), 41)` in `crates/browser-mcp-server/tests/bridge_test.rs` and update claims in `content/*.md`.

### 🟢 Nits (Formatting & Style)
9. **Editorial Refinements**: Replace "blowing its context" with "exceeding context limits", remove "ultra-compact", and fix `format="raw"` to `format="html"`.
10. **Syntax Standardization**: Replace 80-character dividers with standard `---`.
