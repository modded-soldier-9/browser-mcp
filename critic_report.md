# EGM Critic Review: `docs/designs/token-efficient-semantic-accessibility.md` (lines 1-215)

**Verdict**: **REVISE**  
**Contributing Lenses**: `egm-design`, `egm-structural`, `egm-style`

---

## 1. Architectural & Protocol Findings (Design Lens)

### 🔴 Blocker: Volatile Element Handle Identity Across Turns
- **Scope**: Lines 34–35, 123–125, 180
- **Flaw**: Sequential re-indexing (`[e1]`, `[e2]`) on each snapshot causes handle shifts when SPAs insert elements, leading to destructive mis-clicks on subsequent turns.
- **Fix**: Anchor handles to CDP `backendNodeId` in a persistent session map (`Map<backendNodeId, handle>`). Only increment monotonically for new elements; never re-index existing nodes until full navigation.

### 🔴 Blocker: Manifest V2 Packaging & Module Incompatibility
- **Scope**: Lines 117, 220–224
- **Flaw**: `extension/src/dom-inspector.js` uses ES module syntax, but Chrome MV2 background scripts do not support modules without a bundler. It is absent from `manifest.json`.
- **Fix**: Consolidate distillation logic directly into `extension/background.js`.

### 🟡 Major: Context Shield Sandbox Black Hole for Remote Agents
- **Scope**: Lines 141–153
- **Flaw**: Spooling exclusively to host disk (`~/.browser-mcp/snapshots/`) leaves containerized, SSH-tunneled, or remote AI agents permanently blinded.
- **Fix**: Add in-band MCP pagination (`browser_get_page_content({ snapshot_id, page_offset, limit })`).

---

## 2. Structural & Layout Findings (Structural Lens)

### 🟡 Major: Missing Schema Parameter Tables
- **Scope**: Lines 164–177
- **Flaw**: Parameters for `browser_get_page_content` and `browser_search_elements` are listed as unformatted bullet points rather than structured Markdown tables.
- **Fix**: Reformat into standard tables: `Parameter | Type | Default / Required | Description`.

### 🟡 Major: Missing Security & Privacy Considerations Section
- **Scope**: Section required before line 186
- **Flaw**: Missing mandatory security section addressing disk file permissions (`0600`), PII/credential protection, and origin scoping for local snapshots.
- **Fix**: Insert `## Security & Privacy Considerations`.

### 🟡 Major: Asymmetric Alternatives & Missing Trade-Off Matrix
- **Scope**: Lines 186–213
- **Flaw**: Alternatives section lacks a unified comparison table evaluating Token Cost, Precision, Latency, and Maintenance.
- **Fix**: Add a 5-column Markdown tradeoff evaluation matrix.

---

## 3. Style & Tone Findings (Style Lens)

### 🟡 Major: Informal Slang & Promotional Adjectives
- **Scope**: Lines 16, 56, 121, 198, 207–208
- **Flaw**: "blowing its context", "ultra-compact", "crucial", "drastically more expensive", "defeating the single 3 MB static binary architecture".
- **Fix**: Replace slang with objective technical metrics ("exceeding context limits", "compact", "increases per-turn token cost by 3–5x").
