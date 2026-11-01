# EGM Initial Zoom Out Review: `docs/designs/token-efficient-semantic-accessibility.md`

## Overall Verdict
**REVISE**

## 1-Sentence High-Altitude Summary
The proposal over-engineers token optimization by introducing redundant format naming (`format="interactive"`), unbuildable file targets (`extension/src/dom-inspector.js`), and brittle in-Rust state diffing, failing to leverage that 85% of its core goals—including monotonic `[e1]` handles, role filtering, selector resolution, and 95% token compression—are already implemented in `extension/background.js`.

---

## Core Simplification & De-scoping Findings

### 1. [Blocker] Redundant Format Specification vs Existing `format="snapshot"`
* **Affected Scope**: Lines 14–15, 96–102, 117–126, 167–170, Phase 1 (Lines 261–266).
* **Simplicity Rationale**: The design proposes adding `format="interactive"` to extract actionable elements and assign monotonic `[e1]` handles. However, `browser_get_page_content` already implements `format="snapshot"` (and `format="aria"`), using `generateAriaSnapshot` in `extension/background.js` to prune non-interactive containers, assign sequential `[e1]` handles, and set `data-bmcp-ref`. Adding `format="interactive"` duplicates existing functionality.
* **Simplification**: Alias `format="interactive"` to `format="snapshot"` or enhance `format="snapshot"` in place.

### 2. [Blocker] Unreachable Target: `extension/src/dom-inspector.js` is Not Loaded in MV2
* **Affected Scope**: Lines 117, 220–222, Phase 1 (Lines 261–266).
* **Simplicity Rationale**: The design places distillation in `extension/src/dom-inspector.js` using ES module imports. In reality, the extension runtime is Manifest V2 (`extension/manifest.json`), which loads `background.js` and `offscreen.js` as classic non-module scripts. `scripts/build-extension.mjs` has no bundler. Code written in `extension/src/` will fail with syntax errors or never execute.
* **Simplification**: Place all extension-side DOM distillation logic directly inside `extension/background.js`.

### 3. [Blocker] In-Rust State Delta Engine vs Dom Order Handle Shifts
* **Affected Scope**: Lines 18, 83–85, 154–163, 229–231, Phase 4 (Lines 277–281).
* **Simplicity Rationale**: Implementing state diffing in Rust (`delta.rs`) via `BTreeMap<String, ElementNode>` suffers from a critical flaw: handles `[e1]`, `[e2]` are assigned sequentially in DOM order (`refCount++`). Any element inserted near the top of the DOM shifts all subsequent indices, causing a naive key diff to falsely report that every element on the page was replaced.
* **Simplification**: Simplify delta streaming by maintaining persistent monotonic element handle mapping anchored to CDP `backendNodeId` and computing clean text line diffs.

### 4. [Major] Context Shield Disk Spooling & Remote Agent Isolation
* **Affected Scope**: Lines 16, 35, 83–89, 141–153, 226–228, Phase 3 (Lines 272–276).
* **Simplicity Rationale**: Automatically diverting tool responses >2,500 tokens to `~/.browser-mcp/snapshots/` blinds containerized or remote agents that lack host filesystem access.
* **Simplification**: Provide in-band MCP pagination (`offset`, `limit`) alongside disk spooling so remote clients can paginate without direct host disk access.

---

## Codebase Reuse Opportunities (Ponytail Alignment)
1. **`generateAriaSnapshot` in `extension/background.js` (lines 3859-4012)**: Already implements in-DOM visibility checks, recursive role whitelisting (`button`, `link`, `textbox`, `combobox`, `dialog`), monotonic handle assignment (`refId = 'e' + refCount`), and `data-bmcp-ref` tagging.
2. **`parseSelector` in `extension/background.js` (lines 2074-2090)**: Already regex-matches monotonic reference handles: `/^(?:@|ref[:=]|\[)?(e\d+)\]?$/i`.
3. **`resolveElement` in `extension/background.js` (lines 2092-2129)**: Already maps `e1` handles to physical viewport coordinates with label fallbacks for trusted mouse event dispatch.
