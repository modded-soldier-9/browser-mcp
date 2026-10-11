# 01 — Browser MCP Tool Catalog & Schemas

Browser MCP exposes 40 focused tools across 4 main functional domains:

---

## 1. Navigation & Inspection
- `browser_navigate(url, new_tab=false)`: Navigate active tab or spawn a new session tab.
- `browser_get_page_content(format="text"|"html"|"snapshot", selector=null)`: Extract page content. Format "snapshot" produces a lightweight, accessible semantic tree with element references ([e1], [e2]) for 95% token savings; these refs can be passed directly to `browser_click` or `browser_fill`.
- `browser_screenshot(path=null, full_page=false)`: Capture viewport or full page as base64 PNG, or save directly to a given filepath.
- `browser_extract_list(selector, container=null, max_rows=500)`: Automatically scroll virtualized or infinite-scroll tables/feeds to extract complete rows.
- `browser_list_tabs()`: List all tabs currently assigned to your session.
- `browser_switch_tab(tab_id)`: Bring a specific session tab to the foreground.
- `browser_close_tab(tab_id=null)`: Close a specific session tab (or current active tab).
- `browser_get_new_tab(url)`: Convenience shortcut to open and switch to a new tab.

---

## 2. Page Interaction
- `browser_click(selector, ref=null)`: Click an element using an element reference handle (e.g. "e1", "@e1"), CSS selector, or text selector. Real CDP mouse events with auto-scroll and label fallback for 0x0 controls.
- `browser_click_xy(x, y)`: Raw coordinate click in CSS pixels (trusted hardware events).
- `browser_double_click(selector)`: Double-click an element.
- `browser_right_click(selector)`: Context click.
- `browser_hover(selector)`: Hover mouse over target element. Supports element reference handles (e.g. "e1").
- `browser_fill(selector, value, ref=null)`: Clear and type into inputs, textareas, and contenteditable fields. Supports element reference handles (e.g. "e1"), CSS selectors, or text selectors. Native React/Vue/Angular tracker sync.
- `browser_press_key(key, ctrl=false, alt=false, shift=false, meta=false)`: Send keyboard key ("Enter", "Tab", "Escape", "ArrowDown").
- `browser_select_option(selector, value)`: Select option in native `<select>` dropdowns.
- `browser_set_combobox(selector, value)`: Search, select, or multi-select in dynamic comboboxes (AntD, React-Select, Radix, Shadcn).
- `browser_scroll(x=0, y=0, selector=null)`: Scroll window or a specific container.
- `browser_set_date(selector, date)`: Set date/time values formatted for datepickers.

---

## 3. DOM & Developer Tooling
- `browser_execute_script(code)`: Execute arbitrary JavaScript with native support for top-level `await`, `const`/`let`, and return statements.
- `browser_upload_file(selector, files)`: Set file input programmatically without triggering OS file picker modals.
- `browser_drop_file(selector, files)`: Simulate HTML5 drag-and-drop file transfer onto upload zones.
- `browser_console_logs(limit=50)`: Retrieve recent browser console logs and JavaScript errors.
- `browser_get_cookies(urls=null)`: Retrieve browser cookies for authenticated sessions.
- `browser_set_cookies(cookies)`: Inject session cookies.
- `browser_get_local_storage(key=null)`: Read localStorage key/values.
- `browser_set_local_storage(key, value)`: Write localStorage data.
- `browser_list_frames()`: Enumerate all accessible iframe windows on the page.
- `browser_select_frame(frame_index)`: Target a specific iframe for subsequent interactions.

---

## 4. Automation Guardrails & User In-the-Loop
- `browser_ask_user(message, fields=null)`: Display an unobtrusive overlay card requesting 2FA codes, CAPTCHA help, or human confirmation.
- `browser_solve_captcha(action="detect"|"click_checkbox")`: Auto-detect and resolve standard checkbox CAPTCHAs.
- `browser_dismiss_overlays()`: Remove cookie consent banners, newsletter popups, or sticky backdrops.
- `browser_reattach_debugger()`: Force re-attach CDP if an external page evicted the session.
- `browser_about(intent, title, body)`: Submit diagnostic reports or feature feedback to the developers.
