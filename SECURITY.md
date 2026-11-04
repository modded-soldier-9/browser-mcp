# Security Policy

Browser MCP controls a real, authenticated browser session, so security is paramount. Please report all vulnerabilities privately.

## Reporting a Vulnerability

Please report vulnerabilities through [GitHub Private Vulnerability Reporting](https://github.com/modded-soldier-9/browser-mcp/security/advisories/new) or by emailing **moddedsoldier@gmail.com** with:

- Description of the attack vector and preconditions.
- Step-by-step reproduction instructions or proof-of-concept.
- Affected Browser MCP version (`browser-mcp --version`) and browser version.

Please do **not** open public GitHub issues for security vulnerabilities.

## Supported Versions

Security updates and patches are published directly to the [GitHub Releases](https://github.com/modded-soldier-9/browser-mcp/releases) page for the latest release series (`v2.x`).

## Security Architecture & Invariants

- **Loopback Origin Verification**: The native Rust WebSocket bridge listens exclusively on `127.0.0.1` (ports 9876–9895) and verifies that connecting WebSocket frames supply an `Origin` matching `chrome-extension://[a-p]{32}`. Unauthorized web pages or scripts connecting to the loopback port are rejected with HTTP 401.
- **Filesystem Containment**: File upload targets (`browser_upload_file`, `browser_drop_file`) and screenshot destinations (`browser_screenshot`) are canonicalized and sandboxed within the current working directory to prevent path traversal attacks.
- **Client LLM Context**: Content read from web pages is passed to the connected MCP AI assistant over standard input/output streams. The Context Shield automatically spools oversized payloads to the user's local directory to protect context windows.
