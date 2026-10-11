# 03 — SPA Interaction & Complex UI Patterns

Modern Single-Page Applications (React, Vue, Angular, Svelte) often break conventional automation tools. Browser MCP incorporates specialized handlers for modern frontend architectures.

---

## 1. Styled Toggles, Switches & Hidden Inputs (0×0 Elements)

In component libraries like **Tailwind UI, Radix Primitives, Shadcn/ui, and Fluent UI**, native `<input type="checkbox">` elements often have `width: 0; height: 0; opacity: 0; pointer-events: none`. Clicking them directly fails with:
`"Element is not visible or has zero size"`

### The Automatic Label Fallback
Browser MCP automatically resolves 0×0 targets:
1. Detects if the target element has zero client rect dimensions.
2. Traverses the DOM for associated trigger elements:
   - `<label for="...">`
   - `.closest('label')`
   - Elements linked via `aria-labelledby` or `aria-describedby`
   - Parent `<button role="switch">` or custom wrappers
3. Dispatches trusted mouse and pointer events directly to the clickable label.

---

## 2. Dynamic Comboboxes & Virtualized Dropdowns

Native `<select>` elements can be manipulated with `browser_select_option`. However, modern apps use custom listboxes (React-Select, Ant Design, Headless UI, Radix Select).

Use `browser_set_combobox`:
```json
browser_set_combobox(
  selector: "div[role='combobox']",
  value: "United States"
)
```
### Execution Pipeline:
1. Focuses and clicks the combobox trigger to open the popup portal.
2. Types the query to filter options if an input field is present.
3. Automatically observes the portal container (even when rendered in `document.body` outside the parent hierarchy).
4. Matches the requested value by exact text, prefix, or case-insensitive substring.
5. Clicks the matching `[role="option"]` and verifies selection closure.

---

## 3. Top-Level `await` in `browser_execute_script`

In vanilla CDP and standard browser drivers, executing `const data = await fetch('/api')` throws a syntax error because the evaluation context is synchronous.

Browser MCP automatically detects statements, declarations (`const`/`let`), and top-level `await`, wrapping user code into an async IIFE:
```javascript
// Automatically wrapped and resolved cleanly:
const res = await fetch('/api/v1/profile');
const json = await res.json();
return json.user.email;
```
- No manual `(() => { ... })()` boilerplate required.
- Promises are awaited, and resolved return values are returned directly.

---

## 4. Modal Overlays & Sticky Backdrops

Consent banners, promotion sheets, and sticky newsletter backdrops often intercept clicks intended for the page.
- Use `browser_dismiss_overlays()` to scan and remove known blocking overlays (`#a360-overlay`, cookie consent dialogs, modal backdrops).
- If an unavoidable dialog requires user confirmation, use `browser_press_key("Escape")` or click the modal dismiss button.
