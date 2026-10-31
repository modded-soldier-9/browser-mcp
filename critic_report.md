# Critic Review Report (Design, Structure & Style)

*   **Target File**: `docs/designs/standalone-rust-browser-mcp.md`
*   **Active Scope**: FeatureRange (Lines 1..245)
*   **Reviewers**: Design Critic (`egm-design`), Structural Layout (`egm-structural`), Style Editor (`egm-style`)
*   **Standard Applied**: `feature-spec-standard.md`

--------------------------------------------------------------------------------

## Executive Summary

The specification establishes a solid foundation for the standalone native Rust architecture, eliminating the Node.js runtime footprint. However, the critic reviews identified two Blocker deficiencies: the absence of a mandatory `## Risks & Mitigations` section and an unworkable cross-sandbox token delivery mechanism. In addition, architectural race conditions in concurrent tool execution and structural syntax errors in the Mermaid diagram must be remediated.

--------------------------------------------------------------------------------

## Findings

### Finding 1: Circular Sandboxed Extension Token Distribution
*   **Severity**: 🔴 Blocker
*   **Source**: Design Critic (`egm-design`), Comprehension (`egm-comprehension`)
*   **Affected Scope**: Lines 44–45, 123–131
*   **Description**: Sandboxed Chrome/Brave extensions run isolated from the OS and cannot read host filesystem files such as `~/.browser-mcp/session.token`. Leaving token discovery as an unresolved open question while marking the specification "Approved" breaks the core security mechanism and impedes zero-config deployment.
*   **Remediation**: Standardize loopback security on binding strictly to `127.0.0.1` and enforcing strict `Origin: chrome-extension://[a-p]{32}` verification, or write a static secret into `config.js` during `browser-mcp install`.

### Finding 2: Missing Mandatory `## Risks & Mitigations` Section
*   **Severity**: 🔴 Blocker
*   **Source**: Design Critic (`egm-design`), Structural Layout (`egm-structural`)
*   **Affected Scope**: Lines 207–245
*   **Description**: Violates `feature-spec-standard.md`. The design lacks a dedicated section explicitly analyzing failure modes, port race conditions across multiple assistants (ports 9876–9895), extension disconnection handling during browser sleep, and configuration file corruption during self-installation.
*   **Remediation**: Add a formal `## Risks & Mitigations` section with concrete mitigations for each operational failure mode.

### Finding 3: Unordered Concurrent Tool Execution Race Conditions
*   **Severity**: 🟡 Major
*   **Source**: Design Critic (`egm-design`)
*   **Affected Scope**: Lines 118–122
*   **Description**: Spawning unstructured Tokio tasks (`tokio::spawn`) for all incoming tool calls allows sequential browser operations (e.g., `browser_navigate` followed immediately by `browser_fill`) to execute concurrently and finish out of order, corrupting active tab automation state.
*   **Remediation**: Separate fast-path read-only requests (`ping`, `browser_about`) from tab mutation commands. Route tab-bound operations through a sequential per-tab command queue.

### Finding 4: Heading Hierarchy Violations & Structural Drift
*   **Severity**: 🟡 Major
*   **Source**: Structural Layout (`egm-structural`)
*   **Affected Scope**: Lines 231–244
*   **Description**: `### Additional Resources` and `### Future Improvements` are formatted as H3 subsections directly beneath `## Non-Functional Requirements`, creating an invalid semantic AST hierarchy.
*   **Remediation**: Elevate both subsections to top-level H2 headings (`## Additional Resources`, `## Future Improvements`).

### Finding 5: Mermaid Diagram Syntax & Edge Anomalies
*   **Severity**: 🟡 Major
*   **Source**: Structural Layout (`egm-structural`), Comprehension (`egm-comprehension`)
*   **Affected Scope**: Lines 74–111
*   **Description**: 
    1. Line 110 (`WATCHDOG -.->|Terminate on Orphan| Server`) connects a child node to its containing subgraph, breaking strict Mermaid parsers.
    2. Node `INSTALLER` is completely disconnected with no inbound or outbound edges.
    3. Browser command responses from `TASK_POOL` or `WS_BRIDGE` dead-end with no arrow routing results back to `STDOUT`.
    4. Stdio edges between `AI` and `STDIN`/`STDOUT` use bidirectional arrows instead of unidirectional data flow.
*   **Remediation**: Fix Mermaid syntax: connect `WATCHDOG` to a terminal `EXIT` node, link `TASK_POOL` -> `STDOUT`, link `INSTALLER` to client configs and filesystem, and make stdio edges unidirectional.

### Finding 6: Banned Promotional Adjectives and Emotive Hyperboles
*   **Severity**: 🟡 Major
*   **Source**: Style Editor (`egm-style`)
*   **Affected Scope**: Lines 11, 13, 33, 70, 116, 177, 186, 205, 241, 348
*   **Description**: The text includes ungrounded promotional adjectives (`seamless transition`), informal hyperboles (`blazingly fast`, `high-throughput, low-latency`, `massive trees`), emotive phrasing (`purges legacy Danish technical debt`, `own the project`), and decorative adverbs (`guaranteeing`, `cleanly`, `gracefully`).
*   **Remediation**: Standardize on neutral technical language: replace `seamless transition` with `support for`, replace `purges legacy Danish technical debt` with `replaces Danish identifiers and comments with standard English`, and remove conversational footer `*Drafted with EGM*`.
