# EGM Implementation Readiness & Codebase Details Report

**Document Target**: `docs/designs/token-efficient-semantic-accessibility.md` (lines 216-286)  
**Reviewers**: `egm-implementation-readiness`, `egm-codebase-details`  
**Verdict**: **REVISE**  
**Actionability Score**: **64 / 100**

---

## 1. Codebase Grounding Violations (Codebase Details Lens)

### 🔴 Blocker: Disconnected Module Target in `extension/src/dom-inspector.js`
- **Finding**: `extension/manifest.json` loads `["background.js", "offscreen.js"]` as classic non-module scripts. Code placed in `extension/src/dom-inspector.js` is not loaded in MV2 and fails syntax checks.
- **Remediation**: Target `extension/background.js` directly, extending existing `generateAriaSnapshot` (lines 3859-4012).

### 🔴 Blocker: Contradiction of Trusted Coordinate Mouse Dispatch vs CDP `DOM.resolveNode`
- **Finding**: `DOM.resolveNode` returns a JS `RemoteObject` which cannot emit `isTrusted=true` hardware mouse events. Existing `browser_click` and `browser_hover` in `background.js` (line 4483) require physical viewport coordinates.
- **Remediation**: Resolve element handles to bounding centers `{ x, y }` via `resolveElement()`.

### 🟡 Major: Missing `tab_id` in Bridge Response Envelope
- **Finding**: `get_page_content` in `background.js` returns `{ content, url, title, ok }` without `tab_id`. The Rust server cannot associate snapshots or deltas with specific tabs without `tab_id`.
- **Remediation**: Include `tab_id: tab.id` in `get_page_content` response payload.

### 🟡 Major: CI Gate Claim Misattribution
- **Finding**: `scripts/check-docs.py` has no hardcoded tool count assertion; it reads dynamically from `tools_schema.json`. The hardcoded `assert_eq!(tools.len(), 40)` is in `crates/browser-mcp-server/tests/bridge_test.rs`.
- **Remediation**: Update `tests/bridge_test.rs` assertions to 41 tools, and update `content/*.md` claims.

---

## 2. Execution Ambiguities & Missing Data Contracts (Readiness Lens)

### 🔴 Blocker: Undefined Data Contracts in Rust
- **Finding**: `crates/browser-mcp-server/src/delta.rs` and `shield.rs` require concrete struct definitions.
- **Remediation**:
  ```rust
  // crates/browser-mcp-server/src/shield.rs
  pub struct ContextShield {
      pub max_tokens: usize,
      pub snapshot_dir: PathBuf,
  }

  // crates/browser-mcp-server/src/delta.rs
  #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
  pub struct ElementSnapshot {
      pub url: String,
      pub title: String,
      pub raw_lines: Vec<String>,
  }
  ```

### 🟡 Major: Shared In-Memory Server State Underspecified
- **Finding**: `main.rs` requires thread-safe shared references (`Arc<tokio::sync::Mutex<DeltaEngine>>` and `Arc<ContextShield>`) passed into `handle_request`.
- **Remediation**: Specify async mutex state plumbing in `main.rs`.
