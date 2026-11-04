// KILDE: https://developers.openai.com/codex/mcp (canonical; redirects to https://learn.chatgpt.com/docs/extend/mcp?surface=cli - verified 15/7: `codex mcp add <name> -- <command>` syntax, `~/.codex/config.toml` default path, `[mcp_servers.<name>]` TOML table, `/mcp` verify command, and config shared across ChatGPT desktop app / Codex CLI / IDE extension)

# Install Browser MCP for OpenAI Codex
*Suggested meta description: "Four steps, about 90 seconds. Codex drives the Chrome you are already signed in to, with your cookies and logged-in sessions intact."*


**Give Codex control of your real, already-logged-in Chrome - about 90 seconds, four steps.** Your cookies, your sessions, your 2FA, instead of a blank headless browser that gets blocked on every login wall.

## The whole thing, in four steps

**1 - Install the extension.** Run `browser-mcp install` to unpack the extension into `~/.browser-mcp/extension/`, then load it under `chrome://extensions` or `brave://extensions` (Developer mode ON → **Load unpacked**).

**2 - Add the MCP server to Codex.** Paste this in a terminal. Required - the extension does nothing on its own:

```bash
codex mcp add browser-mcp -- browser-mcp
```

**3 - Restart your Codex session.** That is what starts the server. The extension shows no badge until step 4 - the server only takes a port the first time your agent actually uses the browser. A green badge with the number of connected agents appears then; nothing on the icon before that is normal. (The icon itself never changes colour - it is the badge that turns green.)

**4 - Say this, to check it worked.** Paste it to Codex:

> Take a screenshot of my current Chrome tab.

You get an image back instead of *"I don't have browser access"*. **That's it - you're running.** → [What else to say](#now-what-things-to-actually-say)

Everything below is the long version.

## Install - 3 steps (~90 seconds)

### Step 1: Add the MCP server to Codex

```bash
codex mcp add browser-mcp -- browser-mcp
```

This writes a `[mcp_servers.browser-mcp]` entry to `~/.codex/config.toml` (Codex's own config command does the writing - you don't touch the file by hand). If you'd rather edit it yourself, the entry looks like this:

```toml
[mcp_servers.browser-mcp]
command = "browser-mcp"
```

Default location: `~/.codex/config.toml` on Mac/Linux (`%USERPROFILE%\.codex\config.toml` on Windows). You can also scope it to one project with a `.codex/config.toml` in that repo, if it's a trusted project.

### Step 2: Load the Chrome extension (one-time)

The MCP server needs a companion Chrome extension to actually drive the browser - this part is identical no matter which MCP client you use.

**Load the extension unpacked:**

1. Run `browser-mcp install` (or [download the latest release zip](https://github.com/modded-soldier-9/browser-mcp/releases/latest)) to extract the extension into `~/.browser-mcp/extension/`
2. Open Chrome → `chrome://extensions`
3. Toggle **Developer mode** on (top right)
4. Click **Load unpacked** (top left) and select `~/.browser-mcp/extension/`
5. The Browser MCP icon appears in your toolbar

### Step 3: Restart Codex and verify

Restart your Codex CLI session so it picks up the new server, then in the composer type:

```
/mcp
```

`browser-mcp` should show up connected, with its tools listed. That's it - no API keys, no cloud account, nothing sent to us.

### Now what - things to actually say

Nothing happens until you ask, and the hardest part of a new tool is knowing what to ask for. Start here:

> Take a screenshot of my current Chrome tab.

If you get an image back instead of *"I don't have browser access"*, both halves are talking. Then:

> Open my Gmail tab and tell me who sent my last 3 emails.

The one that shows the difference - it works because it is *your* browser, already signed in.

> Go to my analytics dashboard, pull this month's numbers, and put them in a table.

Any dashboard you are already logged into. No API key, no export, no integration to build first.

> Fill in this signup form with my details. Stop and ask me before anything sensitive.

You stay in the loop - the agent hands control back for anything it should not decide alone.

The pattern: **anything you would do yourself in a browser, on a site you are already signed into.** Strongest where there is no API. [More examples](https://browsermcp.dev/#try).

## What your Codex agent can do

### The 2FA-killer move

This is the thing headless tools can't do: Codex hits a login wall, reads the one-time code out of your own logged-in Gmail tab, and continues the sign-in - because it's driving *your* browser, not a fresh anonymous one. No API can do that. Use it to operate platforms with no API, QA your own web app end-to-end against real auth, or work dashboards at human pace with you approving the sensitive steps.

### 43 tools, no server-side moving parts

| Category | What it gives your agent |
|---|---|
| **Navigation & content** | `browser_navigate`, `browser_get_page_content`, `browser_screenshot`, `browser_execute_script` |
| **Interaction** | `browser_click`, `browser_fill`, `browser_select_option`, `browser_set_combobox`, `browser_set_date`, `browser_dismiss_overlays`, `browser_hover`, `browser_scroll`, `browser_press_key`, `browser_wait`, `browser_handle_dialog` |
| **Tabs & frames** | `browser_list_tabs`, `browser_switch_tab`, `browser_close_tab`, `browser_get_new_tab` (for OAuth popups), `browser_list_frames` / `browser_select_frame` |
| **Data & network** | `browser_get_cookies`, `browser_set_cookies`, `browser_get_local_storage`, `browser_set_local_storage`, `browser_fetch` (bypasses CORS from the extension), `browser_wait_for_network`, `browser_extract_token`, `browser_console_logs`, `browser_upload_file`, `browser_drop_file` |
| **CAPTCHA assistance** | `browser_solve_captcha` - detects reCAPTCHA v2/v3, hCaptcha, Turnstile and FunCaptcha, attempts the checkbox, then hands the challenge to you if it cannot. No third-party solving service |
| **Human-in-the-loop** | `browser_ask_user` - overlay dialog for 2FA codes, CAPTCHA grids, or any credential Codex shouldn't guess at |
| **Meta** | `browser_about` - session/extension info |

`browser_extract_token` ships with zero-config shortcuts for 9 common dashboards (Stripe, HubSpot, Slack, Shopify, Mailchimp, Pipedrive, Calendly, Google, LinkedIn) - but it isn't limited to those. Point it at any provider's API-settings page and it'll navigate there and walk you through pulling the token the same way; the 9 are just shortcuts, not a whitelist.

Runs up to 20 concurrent browser sessions with color-coded Chrome tab groups, so parallel Codex tasks don't step on each other's tabs.

## Works with any MCP client

Browser MCP is a standard stdio MCP server - it doesn't know or care which client is talking to it. The same `~/.codex/config.toml` entry is shared by the **ChatGPT desktop app**, **Codex CLI**, and the **Codex IDE extension**, so one setup unlocks all three. Outside the Codex/ChatGPT family it works identically with Claude Code, Claude Desktop, Cursor, Cline, Continue, or anything else that speaks MCP - same binary, same extension, same `browser-mcp` command, just wired in with that client's own config format instead of `codex mcp add`.

## FAQ

**Is this an official OpenAI integration?**
No - Browser MCP is an independent, open-source MCP server built by [Mohamed Elsheikh](https://github.com/modded-soldier-9/browser-mcp). It works with Codex because Codex speaks the standard Model Context Protocol, not because of any special partnership.

**Do I need Claude Code installed to use this with Codex?**
No. `codex mcp add` writes straight to Codex's own `~/.codex/config.toml` - nothing about this path touches Claude Code at all.

**Is my browsing data safe? What does the extension see?**
It runs on your machine. The extension talks to an MCP server on `127.0.0.1` that you started - nothing is sent to any remote server, and there is no telemetry or analytics. What your agent reads goes to your AI client and its model provider, like anything else you show it. Cookies and tokens are only pulled when your agent explicitly asks for them, one call at a time. Source is [open and auditable on GitHub](https://github.com/modded-soldier-9/browser-mcp).

**How does CAPTCHA assistance actually work?**
Three layers: (1) auto-detect and click reCAPTCHA/hCaptcha/Turnstile checkboxes, (2) AI-vision-guided grid solving for image challenges, (3) `browser_ask_user` shows you the challenge to solve by hand if the first two miss - then the agent continues. Nothing is routed through a third-party CAPTCHA-solving service. We publish no solve-rate figure - we haven't benchmarked it rigorously enough to stand behind one.

**Is it really free?**
Yes - MIT-licensed, open source, no paywall, no account, no API key. Built by [Mohamed Elsheikh](https://github.com/modded-soldier-9/browser-mcp) as part of its developer-tools work.

**How do I remove it?**
`codex mcp remove browser-mcp` drops the entry from `config.toml`, then remove the extension from `chrome://extensions`. You can also remove the binary and the unpacked directory at `~/.browser-mcp/extension`.

**What if I already have Browser MCP set up for Claude Code?**
The Chrome extension is shared - you only load it once, regardless of how many MCP clients point at it. You just need one more `codex mcp add` (or manual config.toml entry) so Codex knows about the same local server.

---

by [Mohamed Elsheikh](https://github.com/modded-soldier-9/browser-mcp) · MIT License · [GitHub](https://github.com/modded-soldier-9/browser-mcp)