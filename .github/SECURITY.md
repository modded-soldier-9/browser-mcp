# Security Policy

Browser MCP interacts directly with real, authenticated browser sessions to power AI coding assistants. Because it executes within the security context of your browser and local filesystem, we treat security as a paramount invariant.

---

## Supported Versions

We actively provide security patches, advisories, and fixes for the current major release series:

| Version | Supported          | Release Notes / Status               |
|:--------|:-------------------|:-------------------------------------|
| `1.0.x` | :white_check_mark: | Current active release branch        |
| `< 1.0` | :x:                | Deprecated (legacy Node.js prototype)|

---

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

If you discover a security vulnerability or suspect an attack vector, report it confidentially via one of the following methods:

1. **GitHub Private Vulnerability Reporting (Preferred)**:
   Submit an advisory through [GitHub Security Advisories](https://github.com/modded-soldier-9/browser-mcp/security/advisories/new).
2. **Direct Security Contact**:
   Email **moddedsoldier@gmail.com** with the subject line `[SECURITY] Vulnerability Report: Browser MCP`.

### What to Include

To help us triage and resolve the issue quickly, please provide:
- **Summary**: Concise description of the vulnerability and its potential security impact.
- **Attack Vector**: Specific conditions required to exploit the issue (e.g., malicious web page running in another tab, craftily formatted file path, etc.).
- **Proof of Concept (PoC)**: Minimal step-by-step reproduction instructions, sample script, or payload.
- **Affected Environment**:
  - Browser MCP version (`browser-mcp --version` or `extension/manifest.json`).
  - Operating system and version.
  - Browser name and version (e.g., Google Chrome 130, Brave 1.70).
  - Connected AI assistant / client (Claude Code, Antigravity, Cursor, etc.).

### Response Timeline & SLA

- **Acknowledgment**: Within 48 hours of report receipt.
- **Triage & Assessment**: Within 5 business days, including confirmation of reproducibility and severity score.
- **Patch & Disclosure**: Security fixes are prioritized and released in a minor or patch update. Public advisories are coordinated and published after affected users have had reasonable opportunity to update.

---

## Security Architecture & Invariants

Browser MCP enforces defense-in-depth across the boundary between the host OS, the native Rust binary, the WebExtension, and open web pages:

1. **Loopback Origin Verification**:
   The native Rust server binds exclusively to the loopback interface (`127.0.0.1`, ports 9876–9895). Every incoming WebSocket connection handshake must supply a valid `Origin` header strictly matching `chrome-extension://[a-p]{32}`. Arbitrary web pages or third-party localhost processes cannot establish connections to the bridge and receive `HTTP 401 Unauthorized`.
   
2. **Optional Shared Secret Authentication (`BROWSER_MCP_TOKEN`)**:
   In environments requiring additional isolation, the bridge supports an optional authentication token via the `BROWSER_MCP_TOKEN` environment variable, passed to the extension during initialization.

3. **Filesystem Sandbox Containment**:
   All tools that interact with the local filesystem—such as `browser_screenshot`, `browser_upload_file`, and `browser_drop_file`—canonicalize paths against the current working directory (`cwd`). Any attempt to traverse above the project root (`../../`) is rejected before any disk read or write occurs.

4. **Context Shield & Memory Safety**:
   The native server is written in Rust, guaranteeing memory safety without garbage collection overhead. Payloads extracted from the DOM pass through the **Context Shield**, which spools oversized payloads to disk (`~/.browser-mcp/snapshots/`) with LRU limits (`50` files, max `20MB`), preventing memory exhaustion and LLM context window blowup.

5. **Local Data Confidentiality**:
   Browser MCP does not transmit any browsing telemetry, cookies, or page contents to external remote servers. All communication occurs strictly through local standard I/O (to the AI client) and loopback WebSocket (to the local browser extension).
