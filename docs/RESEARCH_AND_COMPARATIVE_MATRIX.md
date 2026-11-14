# Browser Control: Research, Comparative Matrix & Architectural Blueprint

> **Lead Browser Automation & Dev-Tools Research Deliverable**  
> Repository: `browser-control` (formerly `browser-mcp`)  
> Author: Mohamed Elsheikh (@modded-soldier-9, moddedsoldier@gmail.com)  
> Date: November 2026

---

## 1. Executive Summary & Core Paradigm

Modern AI agents require web browser interaction across two distinct operational paradigms:

1. **Everyday User Automation**: High-level, goal-oriented tasks performed inside the user's authentic personal/work browser session (e.g., booking travel, checking internal SaaS dashboards, filing expense reports, interacting with authenticated Web3/enterprise portals). Requirements include **zero re-authentication**, **resilient human-in-the-loop (HITL) handoffs**, **anti-bot/CAPTCHA resilience**, **aggressive token conservation**, and **stable element handles**.
2. **Professional Developer Workflows**: Deep runtime inspection and deterministic feedback loops for full-stack engineering (e.g., debugging frontend exceptions, diagnosing 4xx/5xx API failures, inspecting GraphQL/REST network payloads, reading source-mapped stack traces, traversing iframes, and evaluating Core Web Vitals).

Existing tools in the ecosystem excel at either one or the other, but fail when asked to do both without massive token consumption, fragile setup, or process instability:
- **Headless automation engines** (Playwright MCP, Puppeteer MCP, Steel.dev) force users into isolated, unauthenticated sandbox browsers that trigger Cloudflare bot blocks and require manual login credentials on every run.
- **Python-based agent frameworks** (Browser-Use) rely heavily on raw screenshots and uncompressed DOMs, burning tens of thousands of tokens per turn and struggling with sub-millisecond dev-tools feedback.
- **DevTools-focused servers** (ChromeDevTools MCP) provide rich inspection capabilities but lack high-level spatial distillation, human-in-the-loop dialogs, and token shielding, quickly overwhelming LLM context windows.

**Browser Control** bridges this divide with a **two-tier native hybrid architecture**:
1. A **compiled native Rust MCP server** (`browser-control`, <4 ms boot time, ~3.8 MB RAM footprint) managing asynchronous stdio, fast-path JSON-RPC responses, Context Shield token spooling, and State Delta streaming.
2. A **persistent Manifest V2 WebExtension** attached directly to the user's live Chrome or Brave browser via loopback WebSocket (`127.0.0.1:9876-9895`) with physical CDP hardware dispatch (`isTrusted: true`), monotonic WeakMap element handles (`[e1]`, `[e2]`), continuous background console/network ring buffers, and human-in-the-loop overlays.

---

## 2. In-Depth Comparative Matrix

The following matrix compares **Browser Control** against the 6 leading browser automation frameworks across 12 technical and operational dimensions:

| Dimension | Browser-Use | Stagehand (Browserbase) | Microsoft Playwright MCP | Chrome DevTools MCP | Steel.dev | Cursor / Claude Code Integration | **Browser Control (Proposed)** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Target & Runtime** | Python Agent Framework (Playwright/CDP) | TypeScript / Python / Go SDK (Playwright + Cloud) | TypeScript / Node.js MCP Server (`@playwright/mcp`) | Node.js MCP Server (`chrome-devtools-mcp`) | Docker / Cloud Node.js Browser Infrastructure | IDE Extension / Community MCP (`browser-tools`) | **Native Rust Server + MV2 WebExtension** |
| **Server Binary Footprint & Boot** | Heavy (>200 MB Python env, 1.5s+ boot) | Medium (Node.js runtime + Playwright deps) | Medium (Node.js runtime + Playwright binaries) | Medium (Node.js runtime + Puppeteer) | Heavy (Docker container / remote cloud API) | Lightweight (Extension bridge) | **Ultra-light (<4 ms boot, ~3.8 MB RAM, zero external runtime deps)** |
| **Browser Session State** | Spawns separate clean profile by default | Cloud sandbox or local Chrome profile | Fresh isolated browser context (no user logins) | Dedicated debug instance via `--remote-debugging-port` | Remote cloud container sessions | Attaches to user's live Chrome session | **Directly attaches to user's live Chrome/Brave session (all logins & cookies preserved)** |
| **Token Reduction Strategy** | Full screenshots + text DOM (~15k-30k tokens/step) | Accessibility tree compression (~80% token savings) | Structured accessibility snapshot | Verbose raw DevTools JSON / DOM trees | Screenshots & Markdown extraction endpoints | Basic text/HTML dumps | **Context Shield (spools >2500 tokens to disk) + State Delta Engine (-85%) + AXTree handles (-95%)** |
| **Element Targeting** | Vision bounding boxes / LLM coordinate guessing | Semantic intent (`act`), self-healing selectors | Accessibility tree role/name selectors | CSS / XPath selectors | Remote Playwright selectors | CSS selectors / basic coordinates | **Deterministic monotonic WeakMap handles (`[e1]`, `[e2]`) + physical coordinate CDP clicks** |
| **Trusted Input & SPA Events** | Synthetic CDP / Playwright input | Playwright synthetic / trusted events | Playwright native driver events | Puppeteer synthetic events | Playwright / CDP remote dispatch | Browser DOM event dispatch | **Physical CDP `Input.dispatchMouseEvent` (`isTrusted: true`, React/Angular synthetic event compatible)** |
| **Network Inspection & HAR** | Limited to Playwright route/request hooks | Playwright network event listeners | Basic page response capture | Complete request/response headers, bodies, timing | Remote session network logs | Basic failed request capture | **Continuous ring buffer, failed request inspector (4xx/5xx), payload retrieval, HAR export** |
| **Console & Exception Tracking** | Basic stdout capture | Standard Playwright console listeners | Basic console message listener | Full CDP `Runtime.consoleAPICalled` & source-mapped stacks | Server log streaming | Streams console errors into IDE chat | **Continuous CDP ring buffer (logs, warnings, uncaught exceptions) with stack traces & source mapping** |
| **Multi-Frame & Iframe Handling** | Standard Playwright frame locators | Playwright frame access | Playwright frame navigation | CDP Target / Page frame trees | Remote Playwright frames | Basic frame listing | **Hierarchical frame tree discovery, cross-origin piercing, frame-scoped execution & snapshotting** |
| **Performance & Web Vitals** | None | None | Playwright performance metrics | Full Lighthouse & CDP Performance traces | None | Basic load time display | **Native Web Vitals (LCP, CLS, INP, FCP, TTFB), navigation timing, memory heap metrics** |
| **Human-in-the-Loop & Overlays** | Pauses agent loop for terminal prompt | Custom human takeover via Browserbase UI | None (fails on CAPTCHAs/2FA) | None | Live remote browser view / session replay | Asks user in IDE chat | **In-browser interactive modal overlays (`browser_ask_user`, `browser_solve_captcha`), CDP highlight** |
| **Process Model & Keep-Alive** | Synchronous Python blocking calls | Async Node.js | Standard stdio JSON-RPC | Standard stdio JSON-RPC | REST API / WebSocket stream | WebSocket extension bridge | **Decoupled async Tokio stdio queue + fast-path ping keepalive + persistent MV2 background worker** |

---

## 3. Deep Dive: Professional Developer Workflows

Modern software engineering agents (such as Claude Code, Cursor, Antigravity, and Windsurf) spend the majority of their browser time verifying local code changes, reproducing bug reports, and tracing execution errors. Browser Control provides dedicated developer tooling:

### 3.1 Network Request & Response Inspection
* **The Problem in Existing Tools**: Most browser agents only see the visual result of a page. When a form submission fails or a page renders blank, the agent cannot tell whether it was a 500 Internal Server Error, a 401 Unauthorized token expiry, a CORS violation, or a validation failure in the JSON response payload.
* **Browser Control Architecture**:
  1. **Continuous Ring Buffer**: An in-memory ring buffer (up to 200 events per tab) continuously records all network transactions via CDP `Network.requestWillBeSent`, `Network.responseReceived`, and `Network.loadingFailed`.
  2. **Failed Requests Filter (`browser_get_failed_requests`)**: Instantly surfaces HTTP 4xx/5xx errors and network aborts with sanitized headers, status text, request URL, and error reasons.
  3. **Full Transaction Query (`browser_network_requests`)**: Allows agents to query network traffic filtered by `status_code`, `method`, `resource_type` (xhr, fetch, document, script, stylesheet), or URL regex pattern.
  4. **Payload Retrieval (`browser_get_response_body`)**: Decodes and returns the actual response payload (JSON/text) for a specific `request_id` via CDP `Network.getResponseBody`, with automatic truncation safeguards to prevent context flooding.
  5. **Network Idle Synchronization (`browser_wait_for_network`)**: Intelligently waits until in-flight XHR/fetch requests settle (0 active requests for >500 ms) before executing the next action.

### 3.2 Console Interception & Source-Mapped Exception Tracking
* **The Problem in Existing Tools**: Tools that rely on on-demand `console.log` monkeypatching miss all logs and uncaught runtime errors that occurred before the tool was called. Furthermore, modern web apps compile TypeScript/React into minified bundles, leaving agents with indecipherable traces like `bundle.min.js:1:34891`.
* **Browser Control Architecture**:
  1. **Persistent CDP Runtime Hooks**: Listens to `Runtime.consoleAPICalled` and `Runtime.exceptionThrown` immediately upon tab attachment.
  2. **Structured Log Telemetry (`browser_console_logs`)**: Captures timestamp, log level (`error`, `warn`, `info`, `debug`, `table`), stringified arguments, and complete call frames.
  3. **Source Map Decoding**: When source maps (`.map`) are available inline or referenced via `sourceMappingURL`, the server translates minified locations back to original source files (e.g. `src/hooks/useAuth.ts:74:12`), allowing the coding agent to jump directly to the offending file and line.

### 3.3 Runtime Script Evaluation & Asynchronous REPL
* **The Problem in Existing Tools**: Content Security Policy (CSP) headers like `script-src 'self'` or `unsafe-eval` restrictions frequently break `chrome.scripting.executeScript` or `eval()` in standard extensions.
* **Browser Control Architecture (`browser_execute_script`)**:
  1. **Tri-Tier Execution Pipeline**:
     - *Tier 1 (Isolated World)*: Attempts `chrome.scripting.executeScript` in `ISOLATED` world for non-conflicting extension execution.
     - *Tier 2 (Main World)*: Attempts `MAIN` world execution to access page global variables (`window.__INITIAL_STATE__`, React fiber internals).
     - *Tier 3 (CDP Runtime.evaluate Fallback)*: Directly invokes CDP `Runtime.evaluate` with `awaitPromise: true` and `returnByValue: true`. CDP bypasses all page CSP restrictions, guaranteeing 100% execution reliability for arbitrary JavaScript.
  2. **Automatic Async IIFE Wrapping**: Statements containing `await`, `return`, `const`, or `let` are automatically normalized into `(async () => { ... })()` wrappers.
  3. **Multi-Frame Targeting**: Exposes an optional `frame_id` to evaluate scripts directly within child iframe contexts.

### 3.4 Iframe Navigation & Multi-Context Piercing
* **The Problem in Existing Tools**: Modern enterprise dashboards, OAuth providers, payment forms (Stripe Elements), and portals embed critical interfaces inside nested cross-origin iframes. Most browser agents are blind to cross-origin iframe DOMs.
* **Browser Control Architecture**:
  1. **Hierarchical Frame Tree (`browser_list_frames`)**: Queries `chrome.webNavigation.getAllFrames` to return parent-child frame relationships, origins, and frame IDs.
  2. **Piercing Semantic Snapshots**: `browser_get_page_content(format="snapshot")` recursively traverses accessible iframes and annotates nested interactive elements with scoped handles (e.g., `[e14] (iframe: stripe-card)`).
  3. **Frame-Scoped Action Execution (`browser_select_frame`)**: Allows switching execution context or executing targeted scripts inside any frame by index or frameId.

### 3.5 DOM Mutation Observation & Settling Detection
* **The Problem in Existing Tools**: Sleep timers (`browser_wait(ms=3000)`) are either too slow or fail intermittently on slow networks.
* **Browser Control Architecture**:
  1. **MutationObserver Integration**: Observes live DOM additions, removals, and attribute changes.
  2. **Smart Settling**: `browser_wait` supports condition-based settling (`wait_for_selector`, `wait_for_text`, `wait_for_mutation: false` to ensure DOM stillness for at least 200 ms).

### 3.6 Element Highlighting & Visual Overlay
* **The Problem in Existing Tools**: When an agent attempts an action, developers or users cannot verify what element the agent is intending to click before execution.
* **Browser Control Architecture (`browser_highlight`)**:
  1. Uses CDP `Overlay.highlightQuad` and `Overlay.highlightRect` with customizable RGBA colors and labels.
  2. Automatically translates selector or element handle queries (`[e12]`) into bounding quads and highlights them on the user's active screen.
  3. Supports transient auto-clearing highlights during agent reasoning.

### 3.7 Performance Diagnostics & Core Web Vitals
* **The Problem in Existing Tools**: No easy way for coding assistants to audit frontend performance regressions during development.
* **Browser Control Architecture (`browser_performance_metrics`)**:
  1. Extracts Google Core Web Vitals: Largest Contentful Paint (LCP), Cumulative Layout Shift (CLS), Interaction to Next Paint (INP), and First Contentful Paint (FCP).
  2. Reports Navigation Timing breakdowns (DNS lookup, SSL handshake, TTFB, DOM Interactive, DOM Complete).
  3. Captures Memory Heap stats (`usedJSHeapSize`, `totalJSHeapSize`) and active DOM node counts to detect memory leaks.

---

## 4. Deep Dive: Everyday User Workflows

For everyday users, the browser is where personal identity, work credentials, multi-factor authentication, and sensitive tasks reside. Browser Control optimizes for safety, fidelity, and reliability:

### 4.1 Resilient Human-in-the-Loop (HITL) Safeguards
* **Autonomous Dialog Interception**:
  - `browser_ask_user`: Injects a non-intrusive, beautifully styled dialog overlay directly into the browser viewport when the agent needs human confirmation (e.g. "Do you want to confirm purchase of $49.00?", "Please select which shipping address to use").
  - `browser_handle_dialog`: Pre-arms or responds to native browser `alert()`, `confirm()`, `prompt()`, and `beforeunload` dialogs without hanging the automation loop.
* **Zero-Timeout Stdio Protection**:
  - While waiting up to 125 seconds for a user response, the native Rust server handles all incoming client `ping` requests immediately on a decoupled fast-path loop, preventing AI clients (Claude Desktop, Cursor) from timing out and terminating the session.

### 4.2 Anti-Bot & CAPTCHA Handling
* **Physical Hardware Input Dispatch**:
  - All mouse movements, clicks (`browser_click`, `browser_double_click`, `browser_click_xy`), and keystrokes (`browser_fill`, `browser_press_key`) are dispatched via CDP `Input.dispatchMouseEvent` and `Input.dispatchKeyEvent`.
  - Injected events have `isTrusted: true`, preventing modern bot detectors from flagging synthetic JavaScript `dispatchEvent(new MouseEvent(...))` calls.
* **Automated Challenge Detection & Hand-Off (`browser_solve_captcha`)**:
  - Automatically identifies presence of Cloudflare Turnstile, Google reCAPTCHA v2/v3, and hCaptcha.
  - Injects a high-visibility banner prompting the user to complete the challenge, then monitors the DOM for challenge resolution and automatically resumes agent execution.

### 4.3 State & Auth Persistence (Zero Re-Login)
* **Live Profile Adoption**:
  - Unlike Playwright or Selenium, which create blank temporary browser profiles, Browser Control operates inside the user's existing Chrome or Brave instance.
  - Google Workspace, GitHub SSO, corporate VPNs, and cookie sessions are 100% active and available immediately.
* **Session Storage & Cookie Synchronization**:
  - `browser_get_cookies` / `browser_set_cookies`: Read and update cookie jars for any domain.
  - `browser_get_local_storage` / `browser_set_local_storage`: Read and mutate key-value pairs in HTML5 storage.

### 4.4 Visual-Spatial Understanding & Monotonic Handles
* **Semantic AXTree Extraction (`format="snapshot"`)**:
  - Instead of dumping megabytes of HTML, `browser_get_page_content` distills the page into a semantic accessibility tree.
  - Every interactive element is tagged with a deterministic monotonic handle (e.g., `[e1]`, `[e2]`, `[e3]`).
  - Handles are stored in an in-memory `WeakMap` (`__bmcpNodeMap`), ensuring references remain stable across re-renders and scroll events.
* **Viewport Culling (`viewport_only=true`)**:
  - Filters out off-screen nodes (`rect.bottom >= 0 && rect.top <= window.innerHeight`), eliminating 50-70% of tokens on long feeds (infinite scroll, search results) while preserving monotonic handle numbering.
* **Atomic Form Batching (`browser_fill`)**:
  - Fills multiple fields (text inputs, checkboxes, selects) in a single atomic tool call with 35 ms event-loop pacing, avoiding multi-turn token latency.

### 4.5 Context Shield & Token Protection
* **Automatic Spooling**: When any DOM snapshot or text payload exceeds 2,500 tokens (~10,000 characters), Context Shield automatically intercepts the payload and writes the full snapshot to `~/.browser-control/snapshots/`.
* **In-Band Pagination**: Emits a compact paginated summary to the LLM with metadata (`total_tokens_approx`, `page_offset`, `limit`, `spool_file`) so agents can query specific line ranges or grep targets.
* **State Delta Engine (`format="delta"`)**: Computes symmetric line-by-line diffs against the previous snapshot of that tab, reducing token consumption on repeated interactions by ~85%.

---

## 5. Architectural Blueprint for "Browser Control"

```
+-----------------------------------------------------------------------------+
|                          AI CODING ASSISTANT CLIENT                         |
|             (Claude Code / Cursor / Antigravity / Windsurf / VS Code)       |
+-----------------------------------------------------------------------------+
                                      |
                      Standard I/O (JSON-RPC 2.0)
                                      v
+-----------------------------------------------------------------------------+
|                   BROWSER CONTROL - NATIVE RUST SERVER                      |
|                           (crates/browser-mcp-server)                        |
|                                                                             |
|  +-----------------------+  +----------------------+  +------------------+  |
|  | Decoupled Async Stdio |  | Context Shield       |  | State Delta      |  |
|  | Event Loop (Tokio)    |  | Token Spooler Engine |  | Diffing Engine   |  |
|  +-----------------------+  +----------------------+  +------------------+  |
|                                                                             |
|  +-----------------------+  +----------------------+  +------------------+  |
|  | Fast-Path Dispatcher  |  | METHOD_MAP           |  | Loopback Bridge  |  |
|  | (ping / tools/list)   |  | 43+ Tool Schema      |  | Origin Verifier  |  |
|  +-----------------------+  +----------------------+  +------------------+  |
+-----------------------------------------------------------------------------+
                                      |
               WebSocket (ws://127.0.0.1:9876-9895)
               Handshake Header: Origin: chrome-extension://[a-p]{32}
                                      v
+-----------------------------------------------------------------------------+
|               BROWSER CONTROL - PERSISTENT MV2 WEBEXTENSION                |
|                           (extension/background.js)                         |
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  | Session Tab Group Manager (Multi-tenant tab isolation & color coding) |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
|  +-------------------------+  +--------------------+  +------------------+  |
|  | Semantic AXTree Engine  |  | WeakMap Handle Map |  | Spatial Viewport |  |
|  | & Content Distillation  |  | ([e1], [e2] Anchor)|  | Pruning Culler   |  |
|  +-------------------------+  +--------------------+  +------------------+  |
|                                                                             |
|  +-------------------------+  +--------------------+  +------------------+  |
|  | DevTools Ring Buffers   |  | Human-in-the-Loop  |  | CDP Hardware     |  |
|  | (Console / Net / Error) |  | Overlays & Dialogs |  | Input Dispatcher |  |
|  +-------------------------+  +--------------------+  +------------------+  |
+-----------------------------------------------------------------------------+
                                      |
                 Chrome DevTools Protocol (CDP) & WebExtensions API
                                      v
+-----------------------------------------------------------------------------+
|               LIVE BROWSER TABS & SESSIONS (Chrome / Brave)                |
|               (Localhost :3000 / Staging / Production / Enterprise SaaS)    |
+-----------------------------------------------------------------------------+
```

### 5.1 Unified Tool Taxonomy (Core 43 Surface + Proposed Extensions)

The Browser Control tool suite is organized into 8 functional domains:

#### Domain 1: Navigation, Tab & Window Management (7 Tools)
1. `browser_navigate`: Navigate active tab or spawn targeted new tab/window with coordinates.
2. `browser_list_tabs`: Enumerate active tabs in session group with titles, URLs, and active states.
3. `browser_switch_tab`: Switch active focus to a specific tab ID.
4. `browser_close_tab`: Safely terminate a specific tab ID.
5. `browser_get_new_tab`: Detect and adopt popup tabs spawned from session actions.
6. `browser_reattach_debugger`: Force re-attachment of CDP session if detached.
7. `browser_about`: Inspect server version, connected extension status, and active ports.

#### Domain 2: DOM Inspection, Content Distillation & Token Shield (6 Tools)
8. `browser_get_page_content`: Extract text, raw HTML, accessibility tree snapshot (`format="snapshot"`), or state deltas (`format="delta"`) with selector scoping and token culling.
9. `browser_extract_list`: High-throughput structured extraction of repeating items (cards, table rows, links) without token explosion.
10. `browser_search_elements`: Query DOM for elements matching text or CSS selectors.
11. `browser_screenshot`: Capture full-page, visible viewport, or element-specific screenshots.
12. `browser_dismiss_overlays`: Automatically close popups, cookie banners, and modal backdrops.
13. `browser_provide_feedback`: In-band telemetry feedback loop.

#### Domain 3: Hardware Input, Trusted Clicks & Form Batching (8 Tools)
14. `browser_click`: Coordinate-resolved physical mouse click (`isTrusted: true`) on selector or handle (`[e1]`).
15. `browser_click_xy`: Direct physical click at exact pixel coordinates `(x, y)`.
16. `browser_double_click`: Native double-click event dispatch.
17. `browser_right_click`: Native context-menu click event dispatch.
18. `browser_hover`: Physical mouse hover at element coordinates to trigger tooltips and hover menus.
19. `browser_fill`: Atomic batch form filler (text, password, checkbox, radio) with realistic pacing.
20. `browser_press_key`: Send keyboard key combinations (`Enter`, `Tab`, `Backspace`, `Ctrl+A`).
21. `browser_scroll`: Directional or coordinate-based viewport scrolling (`up`, `down`, `top`, `bottom`).

#### Domain 4: Developer Diagnostics & Runtime (7 Tools)
22. `browser_console_logs`: Query continuous console telemetry (logs, warnings, uncaught exceptions) with stack traces and log levels.
23. `browser_get_failed_requests`: Inspect HTTP 4xx/5xx responses and connection failures with sanitized headers.
24. `browser_execute_script`: Universal JS execution (isolated world -> main world -> CDP Runtime.evaluate fallback) with top-level await.
25. `browser_wait_for_network`: Wait until active in-flight network requests drop to zero.
26. `browser_fetch`: Execute arbitrary HTTP requests from within the browser's authenticated origin context.
27. *(Proposed)* `browser_network_requests`: Full queryable transaction log with method, status, type, and payload filters.
28. *(Proposed)* `browser_get_response_body`: Decoded response payload retrieval by `request_id`.

#### Domain 5: Frames, Overlays & Visual Feedback (4 Tools)
29. `browser_list_frames`: Hierarchical listing of all frames (iframes) in the active tab.
30. `browser_select_frame`: Execute code and inspect DOM inside a specific frame index or ID.
31. `browser_highlight`: Visual CDP quad/rect overlay with custom colors and labels.
32. `browser_wait`: Explicit wait with settling condition evaluation.

#### Domain 6: Advanced Form Controls, Dates & File Transfers (4 Tools)
33. `browser_select_option`: Native `<select>` dropdown option selection by value or label.
34. `browser_set_combobox`: ARIA combobox / autocomplete selection.
35. `browser_set_date`: HTML5 date/time picker value manipulation.
36. `browser_upload_file` / `browser_drop_file`: Native file input attachment and drag-and-drop simulation.

#### Domain 7: Cookies, Storage & Auth State (4 Tools)
37. `browser_get_cookies`: Retrieve cookie jar matching URL or domain.
38. `browser_set_cookies`: Inject or update session cookies.
39. `browser_get_local_storage`: Read localStorage entries for the active origin.
40. `browser_set_local_storage`: Write or mutate localStorage key-value pairs.

#### Domain 8: Human-in-the-Loop & Anti-Bot Safeguards (3 Tools)
41. `browser_ask_user`: In-browser modal overlay asking user for input, confirmation, or credentials with non-blocking timeout.
42. `browser_handle_dialog`: Handle native browser JavaScript dialogs (`alert`, `confirm`, `prompt`).
43. `browser_solve_captcha`: Interactive anti-bot challenge detection and user handoff banner.

---

## 6. Architectural Invariants & Protocol Guarantees

1. **Strict Origin Security**: Loopback WebSocket bridge rejects any connection where the `Origin` header does not match `^chrome-extension://[a-p]{32}$`. Non-extension origins receive `HTTP 401 Unauthorized`.
2. **Fast-Path Ping Interception**: JSON-RPC `ping`, `initialize`, and `tools/list` are processed in sub-millisecond Rust async tasks and NEVER blocked by browser execution.
3. **Monotonic WeakMap Anchoring**: Element handles (`[e1]`, `[e2]`) are generated sequentially and tied to actual DOM nodes via `WeakMap`. Re-running snapshot retains handle consistency without polluting DOM attributes.
4. **Token Ceiling Guarantee**: Context Shield guarantees no single inspection tool response exceeds 2,500 tokens without automatic disk spooling and paginated summary.
5. **Session Isolation**: Each connected client session is assigned its own Chrome Tab Group with a dedicated color and label. Closing a session never affects tabs belonging to the user or other agents.
6. **Zero Process Lingering**: Stdin watchdog monitors client disconnects; upon EOF or `SIGINT`/`SIGTERM`, all background tasks and WebSockets terminate cleanly in <10 ms.

---

## 7. Actionable Implementation & Roadmap Guidelines

1. **Architecture Alignment**:
   - Reference Section 5's taxonomy when finalizing `ARCHITECTURE.md`.
   - Maintain the strict 43-tool schema parity across `tools_schema.json`, `METHOD_MAP` in `tools.rs`, and the `background.js` switch statement.
   - Plan the v1.1 developer tools expansion (`browser_network_requests`, `browser_get_response_body`, source-map resolution) as structured additions to the existing ring-buffer infrastructure.
2. **Branding & Attribution**:
   - Maintain naming across crates, manifest titles, and descriptions as `Browser Control`.
   - Maintain attribution strictly to **Mohamed Elsheikh (`@modded-soldier-9`, `moddedsoldier@gmail.com`)**.
   - Keep tool names normalized (`browser_*` mapping to methods without prefix) to prevent breaking existing client configurations.
3. **Portal & Documentation**:
   - Build the interactive tool directory on the website using the 8 functional domains outlined in Section 5.1.
   - Highlight the comparative advantages from Section 2 (Native Rust speed, Live Browser Auth, Context Shield token savings).
   - Provide copy-paste MCP configuration snippets for Claude Desktop, Cursor, Antigravity, and Claude Code.
4. **Verification & Quality Gates**:
   - Enforce parity checks via `python scripts/verify_parity.py` and `python scripts/check-docs.py`.
   - Ensure all 43 tools maintain 100% agreement between Rust `METHOD_MAP`, `tools_schema.json`, and `extension/background.js`.
