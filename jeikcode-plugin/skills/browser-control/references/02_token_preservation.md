# 02 — Token Preservation & Context Discipline

Token preservation is a fundamental architectural principle in JeikCode. Dumping raw, unconstrained DOMs causes context window exhaustion, high API costs, and degraded model reasoning.

---

## 1. The Cost of Unconstrained Page Dumps

Modern web applications (React, Angular, Vue, Next.js) generate massive DOM trees:
- An unconstrained `browser_get_page_content(format="html")` on a dashboard like Azure, Shopify, or GitHub frequently returns **500,000 to 2,000,000 characters** (>150,000 tokens).
- 90% of that payload consists of repetitive inline styles, SVG icons, data attributes, tracking scripts, and hidden modal templates.

---

## 2. Funnel Extraction Rules

Always follow the 3 golden rules for reading web pages:

### Rule 1: Always Scope Reads with a `selector`
Target only the content area relevant to your current subtask:
```json
// BAD: Dumps entire page including headers, footers, sidebars, modals
browser_get_page_content()

// GOOD: Targets only the main content section
browser_get_page_content(selector="main")
browser_get_page_content(selector="article")
browser_get_page_content(selector="#content")
browser_get_page_content(selector="table.orders-table")
```

### Rule 2: Prefer Plain Text Over Raw HTML
- Plain text (`format: "text"`) strips all tag overhead while preserving structural indentation, headers, and readable content.
- It reduces token consumption by **85% to 95%** compared to HTML.
- Only use `format: "html"` when inspecting specific element attributes (e.g. extracting `href`, `data-id`, or input attributes).

### Rule 3: Use `browser_extract_list` for Long Feeds
- Virtualized tables (mail inboxes, transaction logs, order histories) only render 10–20 rows in the DOM at any given moment.
- Repeatedly calling `browser_get_page_content` while scrolling returns redundant DOM overhead on each turn.
- Instead, call `browser_extract_list(selector="tr.row", max_rows=100)`. It automatically scrolls the scrollable container, deduplicates items in-memory, and returns clean, structured data in a single tool call.

---

## 3. Targeted Evaluation via `browser_execute_script`

When you only need a specific datum (e.g. a token, user ID, status code, or table summary), evaluate directly in the page:
```javascript
// Efficient: returns ~50 tokens instead of an entire page
browser_execute_script(code="(() => ({
  status: document.querySelector('.status-badge')?.innerText,
  orderId: new URLSearchParams(location.search).get('id'),
  total: document.querySelector('#total-price')?.innerText
}))()")
```
