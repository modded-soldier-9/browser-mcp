# scripts

## Overview
The `scripts` component provides build, documentation generation, CI/CD verification, and extension validation tooling for the Browser MCP workspace.

## Interface
- [`build-extension.mjs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/build-extension.mjs): Extension build and distribution synchronization script verifying JavaScript syntax and keeping `extension/` and local runtime directories (`~/.browser-control/extension/` and `~/.browser-mcp/extension/`) in byte-for-byte parity.
- [`check-docs.py`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/check-docs.py): CI documentation quality gate verifying tool counts against `crates/browser-mcp-server/tools_schema.json`, internal link validity, metadata completeness, sitemap parity, and version release truth.
- [`generate-docs.py`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/generate-docs.py): Static site generator transforming `content/*.md` into production HTML under `docs/` with structured JSON-LD schemas and updated `sitemap.xml`.
- [`test-mcp-compliance.mjs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/test-mcp-compliance.mjs): Automated offline stdio JSON-RPC protocol compliance test suite verifying all 43 tool schemas, error handling, and framing without launching or controlling a live browser.
- [`verify_parity.py`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/verify_parity.py): Continuous tool parity verification script ensuring exact 1:1 synchronization across JSON Schema, Rust server method maps, and extension dispatch handlers.

## Invariants
- `extension/` must contain valid `manifest.json`, `background.js`, `offscreen.js`, `popup.html`, and `popup.js`; `background.js` and `popup.js` must compile cleanly without syntax errors [`build-extension.mjs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/build-extension.mjs).
- All tool count claims across documentation and `docs/docs/tools/index.html` must exactly match the 43 tools defined in `crates/browser-mcp-server/tools_schema.json` [`check-docs.py`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/check-docs.py).
- No document may state that a version is unreleased if git tags show that version has already shipped [`check-docs.py`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/check-docs.py).

## Side Effects
- Recursively copies extension source files to `~/.browser-mcp/extension/` [`build-extension.mjs`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/build-extension.mjs).
- Writes generated HTML pages and `sitemap.xml` to `docs/` [`generate-docs.py`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/scripts/generate-docs.py).

## Verification
- Run: `python scripts/check-docs.py`
