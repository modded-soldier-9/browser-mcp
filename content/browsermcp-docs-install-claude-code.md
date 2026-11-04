// KILDE: mcp-server/bin/cli.js (install registrerer med `claude mcp add --scope user browser-mcp -- browser-mcp`) - kontrolleret mod cli.js og en falsk claude-shim 26/9 (fuld review D). Claude Codes egen dokumentation er ikke hentet paa ny.
# Add Browser MCP to Claude Code
*Suggested meta description: "Four steps, about a minute. Claude drives the Chrome you are already signed in to, so it can read and act on pages behind your logins."*


**Give Claude Code control of your real, already-logged-in Chrome - about a minute, four steps.** 43 browser tools, your actual cookies and sessions, works on 2FA and CAPTCHA-gated sites where headless tools (Playwright, Puppeteer) get blocked. MIT-licensed, free, and runs on your machine - no account, no telemetry, nothing sent to us.

## The whole thing, in four steps

**1 - Install the extension.** Run `browser-mcp install` to unpack the extension into `~/.browser-mcp/extension/`, then load it under `chrome://extensions` or `brave://extensions` (Developer mode ON → **Load unpacked**).

**2 - Add the MCP server.** Paste this in a terminal. Required - the extension does nothing on its own:

```bash
claude mcp add --scope user browser-mcp -- browser-mcp
```

**3 - Restart Claude Code.** That is what starts the server. The extension shows no badge until step 4 - the server only takes a port the first time your agent actually uses the browser. A green badge with the number of connected agents appears then; nothing on the icon before that is normal. (The icon itself never changes colour - it is the badge that turns green.)

**4 - Say this, to check it worked.** Paste it to Claude Code:

> Take a screenshot of my current Chrome tab.

You get an image back instead of *"I don't have browser access"*. **That's it - you're running.**

Using Cursor, VS Code, Codex or Windsurf instead? Same server, that client's own config - [guides here](/docs/install-cursor). The rest of this page is the long version, plus [what to say next](#now-what-things-to-actually-say).


---

## Step-by-step install (Claude Code)

**Why two steps?** Browser MCP is two halves and both are required: a **Chrome extension** that drives the browser, and a **local native MCP server** that Claude Code talks to. Chrome forbids extensions from installing themselves without human confirmation in Developer mode. Both halves are necessary for the bridge to work.

### Step 1 - Register the MCP server with Claude Code

```bash
claude mcp add --scope user browser-mcp -- browser-mcp
```

That is Claude Code's own MCP command, so the entry lands in the config Claude Code actually reads. `--scope user` makes Browser MCP available in every project instead of just the current directory; drop it if you only want it here.

Prefer to edit the config by hand? Add this to `~/.claude.json`:

```json
{
  "mcpServers": {
    "browser-mcp": {"command": "browser-mcp"}
  }
}
```

If you want the extension files on disk too (for the unpacked install in Step 2), run:

```bash
browser-mcp install
```

It copies the extension to `~/.browser-mcp/extension/` and prints the path - copy it, you'll need it in Step 2. Do not rely on it to configure Claude Code; use the `claude mcp add` command above for that.

### Step 2 - Load the extension in Chrome

Chrome requires extensions in Developer mode to be loaded by the user:

1. Open Chrome and go to `chrome://extensions`
2. Toggle **Developer mode** ON (top right)
3. Click **Load unpacked** (top left, next to "Pack extension")
4. Navigate to `~/.browser-mcp/extension/` and select it
   - **Mac:** in the file picker, press `Cmd+Shift+G`, paste `~/.browser-mcp/extension/`, hit Enter
   - **Windows:** paste `%USERPROFILE%\.browser-mcp\extension\` into the address bar
   - **Linux:** type `~/.browser-mcp/extension/` into the path field

Loading unpacked takes 10 seconds and requires Developer mode ON in Chrome or Brave.

### Step 3 - Restart Claude Code

Restart Claude Code so it picks up the new MCP server. You'll see the Browser MCP icon appear in your Chrome toolbar - that's the extension connected. 43 browser tools are now available in any Claude Code conversation.

### Verify it's working

Paste this to Claude Code:

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
3. Follow Step 2 above, but select the unzipped folder instead of `~/.browser-mcp/extension/`
4. Wire up Claude Code manually - add this to `~/.claude.json`:

```json
{
  "mcpServers": {
    "browser-mcp": {"command": "browser-mcp"}
  }
}
```

Or skip the manual JSON entirely and let Claude Code write it:

```bash
claude mcp add --scope user browser-mcp -- browser-mcp
```

---

## What your agent can do

### The 2FA killer move

This is the reason people install Browser MCP: Claude Code hits a login wall, needs a verification code, and - because it's driving your actual logged-in Chrome rather than a fresh headless session - it can switch to your own Gmail tab, read the code, and finish the sign-in itself. No API can do that; there's no "read my 2FA code" endpoint to call. It works because Browser MCP isn't simulating a browser, it's operating yours: your cookies, your sessions, your already-passed 2FA challenges.

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

Full source: [github.com/modded-soldier-9/browser-mcp](https://github.com/modded-soldier-9/browser-mcp).

### How this differs from Playwright MCP

| | Browser MCP | Playwright MCP |
|---|---|---|
| Browser | Your real Chrome, always | Its own browser by default. Your real Chrome too, via their Chrome extension |
| Logins/cookies | Your existing session | A persistent profile keeps logins between runs, or your own session via their extension |
| 2FA / CAPTCHA-gated sites | Works, and `browser_ask_user` can ask you for the code mid-run | Reachable in extension mode, but nothing can ask you for a code |
| Human-in-the-loop | `browser_ask_user` pauses, asks you for a code, and continues in the same tab | None. 72 tools, none of which can ask the person anything (checked 2026-09-19) |
| Several agents at once | 20 concurrent, color-coded tab groups | Also supported via their extension: one tab group per connected client |
| Provider integrations | 9 built-in (Stripe, HubSpot, Slack, Shopify, Pipedrive, Calendly, Mailchimp, Google, LinkedIn) | None |
| Install | `browser-mcp install` | `npx @playwright/mcp` |


> **Corrected 2026-09-19.** Four rows in this table used to say Playwright MCP was headless, made
> you log in every time, was frequently blocked on 2FA sites, and could only run one session. All
> four were wrong: Microsoft ships a Chrome extension that uses your own logged-in browser, and
> their own README documents several clients connected at once, each with its own coloured tab
> group. We had corrected this in the main README on 2026-09-07 and did not carry the fix across
> to these pages. The row that survives is human-in-the-loop, and it is measured, not assumed.

### Running more than one Claude Code conversation at once

Each conversation gets its own MCP server on its own port (9876-9895), and the extension keeps every session's tabs in a separate color-coded Chrome tab group - one conversation can't see or click another's tabs. Idle sessions auto-exit after 4 hours without commands.

---

## FAQ

**How do I add an MCP server to Claude Code?**
Run `claude mcp add --scope user browser-mcp -- browser-mcp`. That is Claude Code's built-in command for registering an MCP server, so no manual JSON is required. Restart Claude Code afterward so it picks up the new server.

**What is Browser MCP?**
An MCP (Model Context Protocol) server that gives Claude Code - or any MCP client, including Cursor and VS Code agent mode - control of your actual, already-logged-in Chrome: your cookies, your sessions, your 2FA. 43 tools, MIT-licensed, runs on your own machine.

**Is it free?**
Yes. MIT license, no account, no paid tier.

**Does it only work with Claude Code, or also Cursor / VS Code?**
Any MCP-compatible client. The install command wires up Claude Code specifically. For Cursor or VS Code agent mode, add the same block to that client's MCP config instead:
```json
{"mcpServers": {"browser-mcp": {"command": "browser-mcp"}}}
```

**Why do I have to load the extension manually instead of it just installing?**
Chrome blocks extensions from self-installing from external scripts - that's a Chrome security boundary, not a Browser MCP limitation. Loading unpacked once via `browser-mcp install` is the direct, standard way in.

**Does my browsing data leave my machine?**
Not to us. The MCP server runs locally over stdio, talks to the extension over a local WebSocket, and the extension talks to Chrome through Chrome's own APIs. What your agent reads goes to your AI client and on to its model provider, like anything else you show it - there is no remote server.

**How do I update it?**
The MCP server is a standalone native binary that runs directly. To update the extension, re-run `browser-mcp install` and click **↻ reload** on `chrome://extensions`.

**Chrome extension says "not connected" - what do I check?**
First: did you register the MCP server, not just install the extension? If you loaded the extension and never added the server to your MCP config, that is the whole problem - the extension has nothing to connect to. Run `claude mcp add --scope user browser-mcp -- browser-mcp` and restart Claude Code. If the server *is* configured, confirm the extension is loaded under `chrome://extensions`, click the extension icon → "Reconnect," and give it 2-3 seconds - it scans ports 9876-9895 for the running server. Still stuck: [troubleshooting](/docs/troubleshooting).

**Is this the same as browsermcp.io?**
No - different project, same underlying idea (MCP + your real Chrome), separate codebase. If you found this page searching generically for "browser mcp," make sure you're grabbing the one you meant: this one is `browser-mcp` on GitHub (`modded-soldier-9/browser-mcp`).

**Can I run it across multiple Claude Code conversations at once?**
Yes - up to 20 concurrent sessions, each on its own port with its own color-coded Chrome tab group, so sessions can't see or control each other's tabs.