# Implementation Readiness Report

*   **Target File**: `docs/designs/standalone-rust-browser-mcp.md`
*   **Active Scope**: DetailedRange (Lines 246..394)
*   **Reviewers**: Pragmatic Tech Lead (`egm-implementation-readiness`), Codebase Details Auditor (`egm-codebase-details`), Style Editor (`egm-style`)
*   **Standard Applied**: `implementation-readiness-standard.md`

--------------------------------------------------------------------------------

## Tech Lead Assessment

The Detailed Implementation Plan accurately identifies the primary components requiring modification but contains several critical discrepancies against actual codebase structure, schema locations, and script dependencies. These blockers must be corrected before an implementer can execute the plan without ambiguity.

--------------------------------------------------------------------------------

## Findings

### Finding 1: Hallucinated Schema File Path
*   **Severity**: 🔴 Blocker
*   **Source**: Codebase Details Auditor (`egm-codebase-details`)
*   **Affected Scope**: Line 292 (Item 6)
*   **Codebase Reality**: The document specifies modifying `crates/browser-mcp-server/src/tools_schema.json`. This path does not exist. The actual catalog file is located at `crates/browser-mcp-server/tools_schema.json` and is included directly in `crates/browser-mcp-server/src/tools.rs:5` via `include_str!("../tools_schema.json")`.
*   **Remediation**: Update the target file path in Item 6 to `crates/browser-mcp-server/tools_schema.json`.

### Finding 2: Inverted WebSocket Client Architecture in Extension
*   **Severity**: 🔴 Blocker
*   **Source**: Implementation Readiness (`egm-implementation-readiness`), Codebase Details (`egm-codebase-details`)
*   **Affected Scope**: Lines 330–340 (Items 11 and 12)
*   **Codebase Reality**:
    1. The document asserts that `extension/background.js` initiates and manages the WebSocket bridge connection to `ws://127.0.0.1:9876`. In reality, `extension/offscreen.js` (lines 4–9, 206) hosts and manages the WebSocket client connection across ports 9876–9895.
    2. The document claims `background.js` contains Danish variable names `alleePorteOptaget`, `sikrePort`, `loesPortLoefte`, `ledErDoedt`, and `forfaedreKaede`. None of these exist in `background.js` (the first three belong to legacy Node `mcp-server/index.js`, and the last two to `mcp-server/vagt.js`). Actual Danish variables in `background.js` are `brugte`, `nummer`, `husket`, `pladsPrPid`, `husketPlads`, and `levendePorte`.
*   **Remediation**: Reassign WebSocket connection updates to `extension/offscreen.js`, and correct the inventory of Danish identifiers in `background.js`.

### Finding 3: Purging `mcp-server/` Breaks Verification Tool `scripts/check-docs.py`
*   **Severity**: 🔴 Blocker
*   **Source**: Implementation Readiness (`egm-implementation-readiness`), Codebase Details (`egm-codebase-details`)
*   **Affected Scope**: Line 351 (Item 14) and Line 390 (Verification Plan)
*   **Codebase Reality**: Item 14 deletes `mcp-server/`, but line 390 prescribes running `python scripts/check-docs.py` for verification. `scripts/check-docs.py:78` and `scripts/generate-docs.py:60` hardcode reads to `mcp-server/tools.js`. Deleting `mcp-server/` causes immediate `FileNotFoundError`.
*   **Remediation**: Add `scripts/check-docs.py`, `scripts/generate-docs.py`, and `package.json` to the target file list to switch schema loading to `crates/browser-mcp-server/tools_schema.json` and replace npm scripts with cargo workflows.

### Finding 4: Flat Catalog Violates Phasing & Checkpoints Rule
*   **Severity**: 🔴 Blocker
*   **Source**: Implementation Readiness (`egm-implementation-readiness`)
*   **Affected Scope**: Lines 246–372
*   **Description**: The plan presents a flat, unordered catalog of 16 file modifications without sequential execution phases, dependency ordering, or intermediate build checkpoints.
*   **Remediation**: Structure the implementation plan into 4 sequential phases:
    1. *Phase 1: Rust Engine Core (Async Stdio, Ping Fast-Path, Port Discovery)*
    2. *Phase 2: Self-Installer & Watchdog Refactor (`installer.rs`, stdin EOF lifecycle)*
    3. *Phase 3: Extension Offscreen Bridge & Danish Translation (`offscreen.js`, `background.js`)*
    4. *Phase 4: Legacy Node Runtime Decommission & CI/CD (`mcp-server/` removal, doc scripts, GitHub release workflow)*

### Finding 5: Non-Existent File Reference `CLAUDE.md`
*   **Severity**: 🟡 Major
*   **Source**: Codebase Details Auditor (`egm-codebase-details`)
*   **Affected Scope**: Line 367 (Item 16)
*   **Codebase Reality**: `CLAUDE.md` does not currently exist in the repository root or `.claude/`. Item 16 incorrectly labels it `(Modify)`.
*   **Remediation**: Update Item 16 to mark `CLAUDE.md` as `(Create)`.

### Finding 6: Non-Existent Folder `test/hjaelp/` and Unused Permission `webRequest`
*   **Severity**: 🟢 Nit
*   **Source**: Codebase Details Auditor (`egm-codebase-details`)
*   **Affected Scope**: Lines 328, 358 (Items 10 and 14)
*   **Codebase Reality**:
    - Item 14 lists `test/hjaelp/` for deletion, but that folder does not exist.
    - Item 10 asks to verify `webRequest` permission in `extension/manifest.json`, but `webRequest` is not used in the extension.
*   **Remediation**: Remove `test/hjaelp/` and `webRequest` from the plan.
