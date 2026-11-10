## Description

Briefly describe the changes, motivation, or bug fix introduced in this pull request.

Fixes #(issue)

---

## Type of Change

- [ ] 🐛 **Bug fix** (non-breaking change fixing an issue)
- [ ] ✨ **New feature** (non-breaking change adding functionality or new tool)
- [ ] ⚡ **Performance optimization** (latency, memory, or token overhead reduction)
- [ ] 🛠️ **Refactor / Architecture** (code simplification, cleanup, or structure improvements)
- [ ] 📖 **Documentation** (updates, guides, or site generation fixes)
- [ ] 🧪 **Testing** (new unit, integration, or benchmark tests)
- [ ] 🔒 **Security** (hardening origin checks, sandbox traversal guards, or credential protections)

---

## Verification & Quality Gates

Run and verify all local quality gates before requesting review:

- [ ] `cargo check --workspace --release` passes warning-free
- [ ] `cargo clippy --workspace --all-targets -- -D warnings` passes cleanly
- [ ] `cargo test --workspace` passes all unit and integration tests
- [ ] `node scripts/build-extension.mjs` validates extension syntax and distribution assets
- [ ] `python scripts/check-docs.py` validates docs integrity and tool count parity
- [ ] Manual browser verification performed in Chrome/Brave (if modifying extension or bridge)

---

## Architectural & Security Invariants

- **Components touched**: `[crates/browser-mcp-server | extension | scripts | docs | workflows]`
- **Loopback Origin Security preserved**: `chrome-extension://[a-p]{32}` origin check intact? `[Yes / N/A]`
- **Filesystem Sandbox maintained**: Path traversal checks enforced for screenshot/upload? `[Yes / N/A]`
- **Token Budgeting / Context Shield**: Spooling and token estimation unaffected? `[Yes / N/A]`
- **Breaking Protocol Changes**: `[None / Yes (describe below)]`

---

## Checklist

- [ ] My code adheres to the project's coding standards and idioms.
- [ ] I have self-reviewed my own changes.
- [ ] I have updated relevant documentation in `content/` or `crates/` if applicable.
- [ ] My commits are descriptive and follow conventional commit syntax (`feat:`, `fix:`, `refactor:`, etc.).
