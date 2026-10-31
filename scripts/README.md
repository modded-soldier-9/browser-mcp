# scripts

## Overview
The `scripts` component provides build, documentation generation, CI/CD verification, and extension validation tooling for the Browser MCP workspace.

## Interface
- [`build-extension.mjs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/build-extension.mjs): Extension build and distribution synchronization script verifying JavaScript syntax and keeping `extension/` and local runtime directories (`~/.browser-mcp/extension/`) in byte-for-byte parity.
- [`check-docs.py`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/check-docs.py): CI documentation quality gate verifying tool counts against `crates/browser-mcp-server/tools_schema.json`, internal link validity, metadata completeness, sitemap parity, and version release truth.
- [`generate-docs.py`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/generate-docs.py): Static site generator transforming `content/*.md` into production HTML under `docs/` with structured JSON-LD schemas and updated `sitemap.xml`.
- [`run-live-showcase.mjs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/run-live-showcase.mjs): Live end-to-end showcase script exercising the compiled Rust binary and extension against a local test page.

## Invariants
- `extension/` must contain valid `manifest.json`, `background.js`, `offscreen.js`, `popup.html`, and `popup.js`; `background.js` and `popup.js` must compile cleanly without syntax errors [`build-extension.mjs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/build-extension.mjs).
- All tool count claims across documentation and `docs/docs/tools/index.html` must exactly match the 40 tools defined in `crates/browser-mcp-server/tools_schema.json` [`check-docs.py`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/check-docs.py).
- No document may state that a version is unreleased if git tags show that version has already shipped [`check-docs.py`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/check-docs.py).

## Side Effects
- Recursively copies extension source files to `~/.browser-mcp/extension/` [`build-extension.mjs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/build-extension.mjs).
- Writes generated HTML pages and `sitemap.xml` to `docs/` [`generate-docs.py`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/generate-docs.py).

## Verification
- Run: `python scripts/check-docs.py`
