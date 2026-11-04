// KILDE: https://code.visualstudio.com/docs/agent-customization/mcp-servers

# Add Browser MCP to VS Code (Agent Mode)
*Suggested meta description: "Copilot gets your real, already-logged-in Chrome rather than a fresh profile, so it can work on pages that need a session."*


**Give VS Code's Copilot agent mode control of your real, already-logged-in Chrome - about 90 seconds, four steps.** 43 browser tools, your actual cookies and sessions, works on 2FA and CAPTCHA-gated sites where headless tools (Playwright, Puppeteer) get blocked. MIT-licensed, free, and runs on your machine - no account, no telemetry, nothing sent to us.

## One click

Paste this into VS Code's Quick Open (`Cmd/Ctrl+P`) or your browser's address bar:

```
vscode:mcp/install?%7B%22name%22%3A%22browser-mcp%22%2C%22type%22%3A%22stdio%22%2C%22command%22%3A%22browser-mcp%22%7D
```

That is VS Code's own install-link format: the encoded part is the same four-line config shown in step 3, URL-encoded. Insiders users swap `vscode:` for `vscode-insiders:`.

You still need the Chrome extension - the server is only half of it.

## The whole thing, in four steps

**1 - Install the extension.** Run `browser-mcp install` to unpack the extension into `~/.browser-mcp/extension/`, then load it under `chrome://extensions` or `brave://extensions` (Developer mode ON → **Load unpacked**).

**2 - Register the MCP server with VS Code.** Paste this in a terminal. Required - the extension does nothing on its own:

```bash
code --add-mcp "{\"name\":\"browser-mcp\",\"command\":\"browser-mcp\"}"
```

**3 - Start the server, then switch Copilot Chat to Agent mode.** Command Palette → **MCP: List Servers** → **Start**, then set the chat mode dropdown to **Agent** (MCP tools only run there). The extension shows no badge until step 4 - the server only takes a port the first time your agent actually uses the browser. A green badge with the number of connected agents appears then; nothing on the icon before that is normal. (The icon itself never changes colour - it is the badge that turns green.)

**4 - Say this, to check it worked.** Paste it to Copilot Chat:

> Take a screenshot of my current Chrome tab.

You get an image back instead of *"I don't have browser access"*. **That's it - you're running.** → [What else to say](#now-what-things-to-actually-say)

Everything below is the long version.

---

## Step-by-step install (VS Code, Agent mode)

### Before you start: GitHub Copilot Chat + Agent mode

Browser MCP's tools surface inside Copilot Chat, so you need the **GitHub Copilot Chat** extension installed (the free tier is enough) and the chat mode dropdown switched from **Ask** (or **Edit**) to **Agent** - MCP tools only run in Agent mode.

### Step 1 - Install the Chrome extension files

```bash
browser-mcp install
```

This copies the extension to `~/.browser-mcp/extension/` and prints the path - copy it, you'll need it in Step 3. (It also writes a Claude Code config entry if you have Claude Code installed; harmless to ignore if you don't.)

### Step 2 - Register the MCP server with VS Code

Pick whichever of these three is easiest - they all end up in the same place.

**A. One-line CLI (fastest)**

```bash
code --add-mcp "{\"name\":\"browser-mcp\",\"command\":\"browser-mcp\"}"
```

Writes the server into your VS Code **user profile** config, so it's available in every window, not just one project. Requires the `code` CLI on your `PATH` - if it's not recognized, run `Shell Command: Install 'code' command in PATH` from the Command Palette first.

**B. Command Palette guided flow**

1. `Cmd+Shift+P` / `Ctrl+Shift+P` → **MCP: Add Server**
2. Choose **Workspace** (writes `.vscode/mcp.json` in this project, good for committing so teammates get it too) or **Global** (user profile, same result as method A)
3. Pick **stdio** as the server type, and enter `browser-mcp` as the command

**C. Edit the JSON by hand**

Workspace-level - create or edit `.vscode/mcp.json` at your project root:

```json
{
  "servers": {
    "browser-mcp": {
      "type": "stdio",
      "command": "browser-mcp"
    }
  }
}
```

For user-level instead, run **MCP: Open User Configuration** from the Command Palette and paste the same block. Note the root key is `servers` - VS Code's own convention, not `mcpServers` (that's the Claude Code / Cursor key - don't copy-paste a Claude Code config block in here verbatim).

### Step 3 - Load the extension in Chrome

Chrome requires extensions in Developer mode to be loaded by the user:

1. Open Chrome and go to `chrome://extensions`
2. Toggle **Developer mode** ON (top right)
3. Click **Load unpacked** (top left, next to "Pack extension")
4. Navigate to `~/.browser-mcp/extension/` and select it
   - **Mac:** in the file picker, press `Cmd+Shift+G`, paste `~/.browser-mcp/extension/`, hit Enter
   - **Windows:** paste `%USERPROFILE%\.browser-mcp\extension\` into the address bar
   - **Linux:** type `~/.browser-mcp/extension/` into the path field

Loading unpacked takes 10 seconds and requires Developer mode ON in Chrome or Brave.

### Step 4 - Start the server and switch to Agent mode

- After you save the config (Step 2), start the server: run **MCP: List Servers** from the Command Palette and choose **Start**/**Enable** (VS Code may also show an inline Start action directly above the server entry when you open the config file - check for it, but `MCP: List Servers` always works). A trust prompt appears the first time; approve it.
- Open Copilot Chat and switch the mode dropdown to **Agent**.
- The Browser MCP icon appears in your Chrome toolbar once the extension connects. 43 browser tools are now available in Agent mode.

### Verify it's working

Paste this to Copilot Chat in Agent mode:

> Take a screenshot of my current Chrome tab.

If you get an image back instead of *"I don't have browser access"*, both halves are talking to each other. That is the whole test.

### Now what - things to actually say

Nothing happens until you ask, and the hardest part of a new tool is knowing what to ask for. Start with these:

> Open my Gmail tab and tell me who sent my last 3 emails.

The one that shows the difference - it works because it is *your* browser, already signed in. A headless tool hits a login wall here.

> Go to my analytics dashboard, pull this month's numbers, and put them in a table.

Any dashboard you are already logged into. No API key, no export, no integration to build first.

> Fill in this signup form with my details. Stop and ask me before anything sensitive.

You stay in the loop - the agent hands control back for passwords, payment details, or anything it should not decide alone.

> Log me in here. If it emails a code, read it from my Gmail tab and continue.

The move no API can make: it reads the one-time code out of your own inbox and finishes the sign-in.

> Walk through my app's signup flow as a real user and tell me where it breaks.

End-to-end QA of your own product, in the same browser your users have.

The pattern: **anything you would do yourself in a browser, on a site you are already signed into.** It is strongest where there is no API - internal dashboards, admin panels, portals, LinkedIn. [More examples](https://browsermcp.dev/#try).

---

## Alternative installs

### Manual zip download

1. Download the extension zip from the [latest GitHub release](https://github.com/modded-soldier-9/browser-mcp/releases/latest)
2. Unzip it anywhere (e.g. `~/Downloads/browser-mcp-extension/`)
3. Follow Step 3 above, but select the unzipped folder instead of `~/.browser-mcp/extension/`
4. Register the server with VS Code - `code --add-mcp "{\"name\":\"browser-mcp\",\"command\":\"browser-mcp\"}"`, or add the `.vscode/mcp.json` block from Step 2C by hand

---

## What your agent can do

### The 2FA killer move

This is the reason people install Browser MCP: Copilot Chat (Agent mode) hits a login wall, needs a verification code, and - because it's driving your actual logged-in Chrome rather than a fresh headless session - it can switch to your own Gmail tab, read the code, and finish the sign-in itself. No API can do that; there's no "read my 2FA code" endpoint to call. It works because Browser MCP isn't simulating a browser, it's operating yours: your cookies, your sessions, your already-passed 2FA challenges.

The same real-session advantage is why it works on 2FA- and CAPTCHA-gated sites that block Playwright and Puppeteer - it is not a fresh anonymous session, it is yours. (We do not build detection-evasion; see when-not-to-use.)

### 43 tools

| Category | Tools |
|---|---|
| **Navigation & content** | `browser_navigate`, `browser_get_page_content`, `browser_screenshot`, `browser_execute_script` |
| **Interaction** | `browser_click`, `browser_fill`, `browser_press_key`, `browser_scroll`, `browser_wait`, `browser_hover`, `browser_select_option`, `browser_set_combobox`, `browser_set_date`, `browser_dismiss_overlays`, `browser_handle_dialog` |
| **Tabs & frames** | `browser_list_tabs`, `browser_switch_tab`, `browser_close_tab`, `browser_get_new_tab`, `browser_list_frames`, `browser_select_frame` |
| **Data & network** | `browser_get_cookies`, `browser_set_cookies`, `browser_get_local_storage`, `browser_set_local_storage`, `browser_fetch`, `browser_wait_for_network`, `browser_extract_token`, `browser_console_logs`, `browser_upload_file`, `browser_drop_file` |
| **CAPTCHA assistance** | `browser_solve_captcha` - detects reCAPTCHA v2/v3, hCaptcha, Turnstile and FunCaptcha, attempts the checkbox, then hands the challenge to you if it cannot. No third-party solving service |
| **Human-in-the-loop** | `browser_ask_user` - overlay dialog for 2FA, CAPTCHA, or credential input, right inside the page |
| **Meta** | `browser_about` - session/extension info |

`browser_extract_token` ships with zero-config shortcuts for 9 common services (Stripe, HubSpot, Slack, Shopify, Pipedrive, Calendly, Mailchimp, Google, LinkedIn) - but it isn't limited to those. For anything else, your agent falls back to `browser_navigate` + `browser_get_page_content` on the provider's own dashboard, so it works for any service, not just the pre-wired nine.

Full source: [github.com/modded-soldier-9/browser-mcp](https://github.com/modded-soldier-9/browser-mcp).

### How this differs from Playwright MCP

| | Browser MCP | Playwright MCP |
|---|---|---|
| Browser | Your real Chrome, always | Its own browser by default. Your real Chrome too, via their Chrome extension |
| Logins/cookies | Your existing session | A persistent profile keeps logins between runs, or your own session via their extension |
| 2FA / CAPTCHA-gated sites | Works, and `browser_ask_user` can ask you for the code mid-run | Reachable in extension mode, but nothing can ask you for a code |
| Human-in-the-loop | `browser_ask_user` pauses, asks you for a code, and continues in the same tab | None. 72 tools, none of which can ask the person anything (checked 2026-09-19) |
| Several agents at once | 20 concurrent, color-coded tab groups | Also supported via their extension: one tab group per connected client |
| Provider shortcuts | 9 zero-config (Stripe, HubSpot, Slack, Shopify, Pipedrive, Calendly, Mailchimp, Google, LinkedIn) - works for any provider via fallback | None |
| Install | Chrome extension + `code --add-mcp` | `npx @playwright/mcp` |


> **Corrected 2026-09-19.** Four rows in this table used to say Playwright MCP was headless, made
> you log in every time, was frequently blocked on 2FA sites, and could only run one session. All
> four were wrong: Microsoft ships a Chrome extension that uses your own logged-in browser, and
> their own README documents several clients connected at once, each with its own coloured tab
> group. We had corrected this in the main README on 2026-09-07 and did not carry the fix across
> to these pages. The row that survives is human-in-the-loop, and it is measured, not assumed.

### Multi-session support

Each running MCP server - whether spawned by VS Code, Claude Code, or Cursor - binds to its own port in the 9876-9895 range, and the Chrome extension keeps every session's tabs in a separate, color-coded tab group, so one session can't see or click another's tabs. Up to 20 concurrent sessions are supported; idle ones auto-exit after 4 hours without commands. That means a VS Code window and a Claude Code conversation can drive Chrome side by side without colliding.

---

## Works with any MCP client

Browser MCP is a standard MCP server over stdio - nothing about it is VS Code-specific under the hood. The exact same `browser-mcp` command works in Claude Code, Cursor, or any other MCP-compatible client; only the config file, and its root key (`servers` here vs. `mcpServers` elsewhere), differs. Also using Claude Code? See the [Claude Code install guide](/docs/install-claude-code).

---

## FAQ

**How do I add an MCP server to VS Code?**
Run `code --add-mcp "{\"name\":\"browser-mcp\",\"command\":\"browser-mcp\"}"` from a terminal, or open the Command Palette (`Cmd/Ctrl+Shift+P`) → **MCP: Add Server** → choose Workspace or Global → **stdio** → command `browser-mcp`. Start the server afterward via **MCP: List Servers** from the Command Palette.

**Do I need GitHub Copilot?**
Yes. Browser MCP's tools surface through Copilot Chat's Agent mode, so you need the GitHub Copilot Chat extension installed and signed in (the free tier is enough) with the chat mode dropdown set to **Agent** - not Ask or Edit.

**Workspace config or user/global config - which should I use?**
Workspace (`.vscode/mcp.json`) if you want the server scoped to one project and want to commit the config so teammates get it automatically. User/global (via `code --add-mcp` or **MCP: Open User Configuration**) if you want it available in every VS Code window. Browser MCP works identically either way.

**Why is the JSON key `servers` instead of `mcpServers`?**
That's VS Code's own convention - Claude Code and Cursor use `mcpServers` as the root key, VS Code uses `servers`. Same server, same executable (`browser-mcp`), different config wrapper. Don't copy a Claude Code config block into `.vscode/mcp.json` verbatim - swap the root key.

**What is Browser MCP?**
An MCP (Model Context Protocol) server that gives VS Code's Copilot agent mode - or any MCP client, including Claude Code and Cursor - control of your actual, already-logged-in Chrome: your cookies, your sessions, your 2FA. 43 tools, MIT-licensed, runs on your own machine.

**Is it free?**
Yes. MIT license, no account, no paid tier. (GitHub Copilot's free tier is enough to use Agent mode.)

**Does my browsing data leave my machine?**
Not to us. The MCP server runs locally over stdio, talks to the extension over a local WebSocket, and the extension talks to Chrome through Chrome's own APIs. What your agent reads goes to your AI client and on to its model provider, like anything else you show it - there is no remote server.

**How do I update it?**
The MCP server is a standalone native binary that runs directly. To update the extension, re-run `browser-mcp install` and click **↻ reload** on `chrome://extensions`.

**Chrome extension says "not connected" - what do I check?**
First: did you register the MCP server, not just install the extension? If you loaded the extension and never added `browser-mcp` to VS Code's MCP config, that is the whole problem - the extension has nothing to connect to. Add the config block from Step 2 above and restart VS Code. If the server *is* configured, confirm the extension is loaded under `chrome://extensions`, click the extension icon → "Reconnect," and give it 2-3 seconds - it scans ports 9876-9895 for the running server. Still stuck: [troubleshooting](/docs/troubleshooting).

**Is this the same as browsermcp.io?**
No - different project, same underlying idea (MCP + your real Chrome), separate codebase. If you found this page searching generically for "browser mcp," make sure you're grabbing the one you meant: this one is `browser-mcp` on GitHub (`modded-soldier-9/browser-mcp`).

**Can I run it in more than one VS Code window at once?**
Yes - each running server instance gets its own port (9876-9895) and its own color-coded Chrome tab group, so concurrent windows or clients don't see or control each other's tabs.