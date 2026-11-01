# EGM Comprehension Review: `docs/designs/token-efficient-semantic-accessibility.md`

**Verdict**: **REVISE**  
**Comprehension Score**: **72 / 100** (B-)

---

## Key Conceptual & Semantic Findings

### 🔴 Blocker: Architectural Contradiction on State Delta Ownership
- **Scope**: Lines 84, 154–164, 224, 230
- **Issue**: Line 224 states `extension/background.js` handles `format="delta"`, while lines 154–164 and 230 state `crates/browser-mcp-server/src/delta.rs` in Rust implements `DeltaEngine`. The boundary contract over the WebSocket bridge is contradictory.
- **Resolution**: Specify that `background.js` returns structured element snapshots with `tab_id`, and Rust's `DeltaEngine` maintains per-tab history and computes symmetric mutation diffs before client stdio delivery.

### 🟡 Major: Context Shield Summary Extraction on Raw HTML
- **Scope**: Lines 141–151, 179
- **Issue**: Non-Goal 2 prohibits HTML parsing crates in Rust. If an agent calls `browser_get_page_content({ format: "html" })` and exceeds 2,500 tokens, Rust cannot extract role counts or top action items without an HTML parser.
- **Resolution**: Clarify that the semantic summary envelope is produced specifically for structured snapshot formats (`snapshot`, `interactive`), while raw `html` and `text` modes receive clean line-based truncation indicators.

### 🟡 Major: Element Handle Lifecycle & Monotonic Invalidation
- **Scope**: Lines 34, 124, 180
- **Issue**: The document states handles are immutable until page navigation, but sequential re-numbering shifts IDs when DOM nodes change dynamically.
- **Resolution**: Explicitly specify that handle IDs increment monotonically per session tab, anchored to CDP `backendNodeId`, preventing index collisions upon DOM insertions.

### 🟡 Major: Bounding Box Dimension Omission
- **Scope**: Lines 123, 134
- **Issue**: Bounding boxes are defined only as `(x, y)` without `width` and `height`.
- **Resolution**: Define `rect` as `{ x, y, width, height }` in CSS viewport pixels.

### 🟢 Nit: Format Naming Typo (`format="raw"` vs `format="html"`)
- **Scope**: Lines 47, 168
- **Issue**: The existing parameter value is `"html"`, not `"raw"`.
- **Resolution**: Replace `"raw"` with `"html"` in schemas and parameter tables.
