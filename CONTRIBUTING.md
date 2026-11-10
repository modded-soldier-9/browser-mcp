# Contributing to Browser MCP

Thank you for your interest in contributing to Browser MCP! Browser MCP is an open-source, high-performance bridge connecting AI coding assistants (Claude Code, Antigravity, Cursor, OpenCode, and others) to real, authenticated browser sessions.

We welcome contributions of all forms: bug reports, architectural ideas, documentation updates, and pull requests.

---

## Code of Conduct

This project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code to foster an open, welcoming, and harassment-free environment for everyone.

---

## Development Environment Setup

### Prerequisites

- **Rust**: Stable toolchain (Rust 1.80+ recommended, including `clippy`).
- **Node.js**: v20 or v22 LTS (for extension syntax and asset verification).
- **Python**: v3.11+ (for documentation generation and gate verification).
- **Browser**: Google Chrome or Brave Browser (for live testing).

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/modded-soldier-9/browser-mcp.git
cd browser-mcp

# 2. Build the native Rust server binary
cargo build --release

# 3. Extract the bundled extension to ~/.browser-mcp/extension
./target/release/browser-mcp install

# 4. Load the extension in your browser:
#    a. Navigate to brave://extensions or chrome://extensions
#    b. Enable "Developer mode" in the top right
#    c. Click "Load unpacked"
#    d. Select the unpacked directory (~/.browser-mcp/extension or ./extension in repo)

# 5. Run the test suite and quality gates
cargo test
cargo clippy --workspace --all-targets -- -D warnings
node scripts/build-extension.mjs
python scripts/check-docs.py
```

---

## Project Structure

```
browser-mcp/
├── Cargo.toml                  # Workspace root manifest
├── package.json                # Workspace metadata and helper scripts
├── crates/
│   └── browser-mcp-server/     # Native compiled Rust MCP server
│       ├── Cargo.toml          # Server dependencies and optimization profile
│       ├── tools_schema.json   # Definitive schema definitions for all 43 tools
│       ├── src/
│       │   ├── main.rs         # Async stdio engine & JSON-RPC dispatcher
│       │   ├── bridge.rs       # WebSocket loopback bridge (ports 9876-9895) & origin security
│       │   ├── shield.rs       # Context Shield token protector & disk spooler
│       │   ├── delta.rs        # State mutation delta diff engine (format="delta")
│       │   ├── tools.rs        # 43 MCP tool definitions and local execution handlers
│       │   ├── installer.rs    # Embedded extension self-installer (include_dir!)
│       │   ├── sandbox.rs      # Filesystem canonicalization & directory traversal guard
│       │   ├── protocol.rs     # JSON-RPC 2.0 and base64 protocol utilities
│       │   └── watchdog.rs     # Stdin EOF & graceful termination handler
│       └── tests/
│           └── bridge_test.rs  # Native integration test suite
├── extension/                  # Chrome & Brave WebExtension
│   ├── manifest.json           # Manifest configuration
│   ├── background.js           # Automation engine, session isolation, and CDP mutex
│   ├── offscreen.js            # WebSocket client bridge connecting to Rust server
│   └── popup.html / popup.js   # Extension status and connection monitor UI
├── content/                    # Markdown source content for documentation
├── docs/                       # Static documentation website (browsermcp.dev)
├── scripts/                    # Validation, packaging, and generator tooling
│   ├── build-extension.mjs     # Extension syntax validation and packaging
│   ├── generate-docs.py        # Static documentation site generator
│   └── check-docs.py           # Documentation integrity, link, and tool parity gate
└── benchmarks/                 # Latency and token overhead benchmarks
```

---

## Contribution Workflow

### 1. Reporting Bugs

Before creating a bug report, please search the [open issues](https://github.com/modded-soldier-9/browser-mcp/issues) to verify it has not been reported. If not, open a [Bug Report](https://github.com/modded-soldier-9/browser-mcp/issues/new?template=bug_report.yml) with:
- Clear, minimal step-by-step reproduction instructions.
- Expected behavior vs. actual behavior.
- Operating system, browser version, and Browser MCP version.
- Relevant terminal logs or DevTools console errors.

### 2. Proposing Features

Have an idea for a new capability or tool?
- Check [WISHLIST.md](WISHLIST.md) to see if it is already planned.
- Open a [Feature Request](https://github.com/modded-soldier-9/browser-mcp/issues/new?template=feature_request.yml) explaining your motivation, target AI client workflow, and suggested API schema.

### 3. Sharing Community Use-Cases

Built an interesting workflow or automation with Browser MCP? Submit a [Use-Case](https://github.com/modded-soldier-9/browser-mcp/issues/new?template=use-case.yml) to be featured in [USE_CASES.md](USE_CASES.md) and on **browsermcp.dev**.

### 4. Code Contributions & Pull Requests

1. **Fork and Branch**:
   ```bash
   git checkout -b feat/my-feature-name
   ```
2. **Implement Changes Following Architectural Invariants**:
   - **Simplicity First (YAGNI)**: Avoid speculative abstractions. Prefer standard library and zero-overhead implementations over external crates.
   - **Security Boundaries**: Never weaken `Origin` verification (`chrome-extension://[a-p]{32}`) or path canonicalization in `sandbox.rs`.
   - **Token Efficiency**: Optimize DOM extraction to respect token budgets and protect context windows.
   - **Deterministic Pacing**: CDP hardware interactions must respect event loop pacing without blocking stdio.
3. **Verify All Quality Gates Locally**:
   ```bash
   # Multi-platform compilation check
   cargo check --workspace --release

   # Strict clippy linter (zero warnings policy)
   cargo clippy --workspace --all-targets -- -D warnings

   # Integration and unit tests
   cargo test --workspace

   # Extension syntax and distribution validation
   node scripts/build-extension.mjs

   # Documentation consistency gate
   python scripts/check-docs.py
   ```
   *Note: If you edit content files in `content/`, re-run `python scripts/generate-docs.py` before running `check-docs.py`.*
4. **Commit with Conventional Commits**:
   Follow conventional commit conventions:
   - `feat: add browser_record_network tool`
   - `fix: handle edge case in base64 screenshot decoder`
   - `perf: optimize delta DOM serialization`
   - `docs: update installation instructions for Cursor`
5. **Open a Pull Request**:
   Push your branch and fill out the [Pull Request Template](.github/pull_request_template.md). Ensure CI checks pass across all operating systems.

---

## Security Policy

For potential security vulnerabilities, please refer to our [Security Policy](SECURITY.md) and report them privately through [GitHub Security Advisories](https://github.com/modded-soldier-9/browser-mcp/security/advisories/new) or via email rather than public issues.
