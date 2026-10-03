/**
 * Browser MCP - Tool Dispatcher & Security Guard
 *
 * Routes incoming MCP tool requests to WebSocket extension commands with
 * filesystem sandboxing (preventing directory traversal and symlink escape on upload/screenshot),
 * timeout adjustments, and diagnostics.
 */

import { dirname, join, resolve, sep, isAbsolute } from 'path';
import { homedir } from 'os';
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, realpathSync, lstatSync, statSync } from 'fs';
import { execFile } from 'child_process';
import { PROVIDER_PAGES } from '../tools.js';
import {
  sendToExtension,
  activeConnection,
  distinctExtensions,
  cmpVersion,
  getActivePort
} from './bridge.js';

const PKG_VERSION = JSON.parse(
  readFileSync(join(dirname(dirname(new URL(import.meta.url).pathname)), 'package.json'), 'utf8')
).version;

const REPO_URL = 'https://github.com/Agent360dk/browser-mcp';
const ISSUE_TEMPLATES = { wish: 'wish.yml', use_case: 'use-case.yml', bug: 'bug.yml' };
const FEEDBACK_LOG = join(homedir(), '.browser-mcp', 'feedback.jsonl');
const loggedFingerprints = new Set();

const METHOD_MAP = {
  browser_navigate: 'navigate',
  browser_get_page_content: 'get_page_content',
  browser_screenshot: 'screenshot',
  browser_execute_script: 'execute_script',
  browser_click: 'click',
  browser_fill: 'fill',
  browser_wait: 'wait',
  browser_press_key: 'press_key',
  browser_scroll: 'scroll',
  browser_hover: 'hover',
  browser_fetch: 'fetch',
  browser_select_option: 'select_option',
  browser_handle_dialog: 'handle_dialog',
  browser_wait_for_network: 'wait_for_network',
  browser_list_tabs: 'list_tabs',
  browser_get_cookies: 'get_cookies',
  browser_get_local_storage: 'get_local_storage',
  browser_ask_user: 'ask_user',
  browser_select_frame: 'select_frame',
  browser_list_frames: 'list_frames',
  browser_get_new_tab: 'get_new_tab',
  browser_switch_tab: 'switch_tab',
  browser_close_tab: 'close_tab',
  browser_upload_file: 'upload_file',
  browser_set_cookies: 'set_cookies',
  browser_set_local_storage: 'set_local_storage',
  browser_console_logs: 'console_logs',
  browser_solve_captcha: 'solve_captcha',
  browser_set_date: 'set_date',
  browser_dismiss_overlays: 'dismiss_overlays',
  browser_set_combobox: 'set_combobox',
  browser_drop_file: 'drop_file',
  browser_double_click: 'double_click',
  browser_right_click: 'right_click',
  browser_click_xy: 'click_xy',
  browser_reattach_debugger: 'reattach_debugger',
  browser_extract_list: 'extract_list',
};

const REPLACEMENTS = {
  double_click: 'call `browser_click` twice',
  right_click: 'use `browser_execute_script` with a contextmenu event',
  click_xy: 'use `browser_click` with a selector',
  extract_list: 'use `browser_get_page_content` and scroll with `browser_scroll`',
  reattach_debugger: 'reload the extension on chrome://extensions',
};

function explainMismatch(message) {
  if (/Debugger attach failed|not attached|ghost/i.test(message || '')) {
    const all = distinctExtensions();
    if (all.length > 1) {
      const active = activeConnection();
      return (
        `Error: ${message}\n\n` +
        `FIRST: ${all.length} Browser MCP extensions are connected concurrently ` +
        `(${all.map((c) => c.extensionId || 'unknown id').join(', ')}). Chrome allows only ONE ` +
        'debugger per tab, so they conflict, causing mouse, keyboard, or file actions to fail.\n\n' +
        'Remedies:\n' +
        '1. Disable extra extensions on chrome://extensions.\n' +
        `2. Pin extension in client config with BROWSER_MCP_EXTENSION_ID=${active?.extensionId || '<id>'}.`
      );
    }
  }

  const m = /Unknown method: ([a-z_]+)/.exec(message || '');
  if (!m) return `Error: ${message}`;
  const active = activeConnection();
  if (active && active.version) return `Error: ${message}`;
  const alt = REPLACEMENTS[m[1]];
  return (
    `Error: browser_${m[1]} exists in this server, but not in your installed Chrome extension.\n\n` +
    'The extension updates via the Chrome Web Store (1-3 days after release), while the server updates instantly via npm.\n' +
    (alt ? `\nUntil then: ${alt}.\n` : '') +
    '\nTo update: chrome://extensions -> Browser MCP -> Reload.'
  );
}

const CHECK_NPM = process.env.BROWSER_MCP_CHECK_NPM === '1';
let npmLatestCache = null;
const NPM_LATEST_TTL_MS = 10 * 60 * 1000;

function npmLatestVersion() {
  if (!CHECK_NPM) return Promise.resolve(null);
  if (npmLatestCache && Date.now() - npmLatestCache.at < NPM_LATEST_TTL_MS) {
    return Promise.resolve(npmLatestCache.version);
  }
  return new Promise((resolve) => {
    execFile('npm', ['view', 'browser-mcp', 'version'], { timeout: 6000 }, (err, stdout) => {
      if (err) return resolve(null);
      const v = String(stdout).trim();
      const ok = /^\d+\.\d+\.\d+/.test(v) ? v : null;
      if (ok) npmLatestCache = { version: ok, at: Date.now() };
      resolve(ok);
    });
  });
}

function truncateUrl(u) {
  if (!u) return null;
  try {
    const x = new URL(u);
    return x.origin + x.pathname;
  } catch {
    return '(unreadable url)';
  }
}

function fingerprint(kind, tool, what) {
  const core = String(what).toLowerCase()
    .replace(/\b[0-9a-f]{8,}\b/g, '#')
    .replace(/\d+/g, '#')
    .slice(0, 160);
  return `${kind}|${tool || '-'}|${core}`;
}

function writeToFeedbackLog(entry) {
  const fp = fingerprint(entry.kind, entry.tool, entry.what_happened);
  const first = !loggedFingerprints.has(fp);
  loggedFingerprints.add(fp);
  if (!first) return { logged: false, reason: 'already logged this session', fingerprint: fp };
  try {
    mkdirSync(dirname(FEEDBACK_LOG), { recursive: true });
    appendFileSync(FEEDBACK_LOG, JSON.stringify({ ...entry, fingerprint: fp }) + '\n');
    return { logged: true, path: FEEDBACK_LOG, fingerprint: fp };
  } catch (e) {
    return { logged: false, reason: e.message, fingerprint: fp };
  }
}

export function handleAbout(args) {
  const intent = args?.intent || 'info';
  const title = args?.title || '';
  const body = args?.body || '';

  const submit_url = intent === 'info' || !ISSUE_TEMPLATES[intent]
    ? `${REPO_URL}/issues/new/choose`
    : `${REPO_URL}/issues/new?template=${ISSUE_TEMPLATES[intent]}` +
      (title ? `&title=${encodeURIComponent(title)}` : '') +
      (body ? `&body=${encodeURIComponent(body)}` : '');

  const instruction =
    intent === 'wish'
      ? `Share this submission link with the user as a clickable link: ${submit_url}`
      : intent === 'use_case'
      ? `Share this use-case link with the user as a clickable link: ${submit_url}`
      : intent === 'bug'
      ? `Share this bug-report link with the user as a clickable link: ${submit_url}`
      : `Browser MCP documentation and community hub: ${REPO_URL}`;

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        name: 'Browser MCP',
        version: PKG_VERSION,
        repo: REPO_URL,
        wishlist: `${REPO_URL}/blob/main/WISHLIST.md`,
        use_cases: `${REPO_URL}/blob/main/USE_CASES.md`,
        submit_url,
        instruction,
      }, null, 2),
    }],
  };
}

export async function handleProvideFeedback(args) {
  const what = String(args?.what_happened || '').trim();
  const kind = args?.kind || 'blocked';
  const tool = args?.tool || null;
  const url = args?.url || null;
  const attempted = args?.attempted || null;

  const npmLatest = await npmLatestVersion();
  const exts = distinctExtensions();
  const active = activeConnection();
  const currentPort = getActivePort();

  const serverOutdated = npmLatest ? cmpVersion(npmLatest, PKG_VERSION) > 0 : null;
  const extVersion = active ? active.version : null;
  const extOutdated = active
    ? (extVersion === null ? true : cmpVersion(PKG_VERSION, extVersion) > 0)
    : null;

  const findings = [];
  const fix_steps = [];

  if (exts.length > 1) {
    findings.push(
      `${exts.length} Browser MCP extensions are loaded concurrently ` +
      `(${exts.map(c => `${c.extensionId || 'unknown'}${c.version ? ' v' + c.version : ''}`).join(' + ')}).`
    );
    fix_steps.push('Disable duplicate extensions in chrome://extensions. Keep only one.');
  }

  if (!active && currentPort === null) {
    findings.push('The browser has not been used in this chat yet, so there is no connection to measure. That is not an error.');
  } else if (!active) {
    findings.push('No Chrome extension is connected to this MCP server right now.');
    fix_steps.push('Check that Chrome is open and Browser MCP is enabled in chrome://extensions, then click Reconnect.');
  }

  if (serverOutdated) {
    findings.push(`The MCP server is running v${PKG_VERSION}, but npm has v${npmLatest}.`);
    fix_steps.push(`Restart the client to update.`);
  }

  if (extOutdated) {
    findings.push(`The extension is v${extVersion || 'legacy'}, server is v${PKG_VERSION}.`);
    fix_steps.push('Update the extension in chrome://extensions.');
  }

  const noPortYet = currentPort === null;
  const verdict =
    exts.length > 1 ? 'conflict'
    : (serverOutdated || extOutdated) ? 'outdated'
    : (!active && noPortYet) ? 'idle'
    : !active ? 'disconnected'
    : (npmLatest === null ? 'unknown' : 'current');

  const environment = {
    mcp_server_version: PKG_VERSION,
    npm_latest_version: npmLatest,
    server_up_to_date: serverOutdated === null ? null : !serverOutdated,
    extensions_connected: exts.map(c => ({
      name: c.name,
      version: c.version,
      extension_id: c.extensionId,
      code: c.code ?? null,
      active: c === active,
    })),
    extension_up_to_date: extOutdated === null ? null : !extOutdated,
    ws_port: currentPort,
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
  };

  const issueBody = [
    what && `**What happened**\n${what}`,
    tool && `\n**Tool**: \`${tool}\``,
    url && `\n**URL**: ${truncateUrl(url)}`,
    attempted && `\n**Already tried**\n${attempted}`,
    `\n**Environment**\n\`\`\`json\n${JSON.stringify(environment, null, 2)}\n\`\`\``,
  ].filter(Boolean).join('\n');

  const template = kind === 'wish' ? ISSUE_TEMPLATES.wish
                 : kind === 'use_case' ? ISSUE_TEMPLATES.use_case
                 : ISSUE_TEMPLATES.bug;
  const issueTitle = what.split('\n')[0].slice(0, 90) || 'Browser MCP feedback';
  const submit_url = `${REPO_URL}/issues/new?template=${template}` +
    `&title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;

  const instruction =
    verdict === 'idle'
      ? 'The browser has not been used in this chat yet, so there is nothing to diagnose about the connection.'
      : verdict === 'conflict' || verdict === 'outdated' || verdict === 'disconnected'
      ? 'Relay fix_steps to user and retry. Share submit_url if issue persists.'
      : 'Installation is healthy. Offer submit_url to user as a clickable link.';

  const loggedLocal = writeToFeedbackLog({
    at: new Date().toISOString(),
    kind, tool, what_happened: what, attempted,
    url: truncateUrl(url),
    verdict,
    server_version: PKG_VERSION,
    extension_version: extVersion,
    extensions_connected: exts.length,
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        reported: { kind, what_happened: what, tool, url, attempted },
        verdict,
        findings,
        fix_steps,
        environment,
        logged_locally: loggedLocal,
        submit_url,
        instruction,
      }, null, 2),
    }],
  };
}

export async function handleExtractToken(args) {
  const { provider } = args;
  const info = PROVIDER_PAGES[provider];

  if (!info) {
    return {
      content: [{
        type: 'text',
        text: `Unknown provider: ${provider}. Known: ${Object.keys(PROVIDER_PAGES).join(', ')}\n\nYou can still use browser_navigate + browser_get_page_content to extract tokens manually.`,
      }],
    };
  }

  const nav = await sendToExtension('navigate', { url: info.url });
  return {
    content: [
      { type: 'text', text: `Navigated to ${info.url} (${nav.title})\n\nInstructions: ${info.instructions}\n\nUse browser_get_page_content or browser_screenshot to find the token.` },
    ],
  };
}

export async function dispatchToolCall(name, args) {
  if (name === 'browser_about') return handleAbout(args);
  if (name === 'browser_provide_feedback') return await handleProvideFeedback(args);
  if (name === 'browser_extract_token') return await handleExtractToken(args);

  const method = METHOD_MAP[name];
  if (!method) {
    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  }

  try {
    // Filesystem security sandbox for file uploads and drops
    if (method === 'upload_file' || method === 'drop_file') {
      const raw = Array.isArray(args?.files) ? args.files : [args?.files || args?.file || args?.file_path].filter(Boolean);
      const root = resolve(process.cwd());
      let rootReal = root;
      try { rootReal = realpathSync.native(root); } catch {}
      const withSep = (r) => (r.endsWith(sep) ? r : r + sep);
      const isInside = (p, r) => p === r || p.startsWith(withSep(r));
      const canonical = [];

      for (const f of raw) {
        const expanded = String(f).replace(/^~(?=\/|$)/, homedir());
        const rawPath = isAbsolute(expanded) ? expanded : withSep(root) + expanded;
        let real = null;
        try { real = realpathSync.native(rawPath); } catch {}

        const reject = (why) => ({
          content: [{
            type: 'text',
            text: `The file must be inside the working directory (${root}). "${f}" ${why}.`
          }],
          isError: true,
        });

        if (!real) return reject(isInside(resolve(rawPath), root) ? 'does not exist (or cannot be read)' : 'points outside');
        if (!isInside(real, rootReal)) return reject('points outside');

        let st = null;
        try { st = statSync(real); } catch {}
        if (!st || !st.isFile()) return reject('is not a regular file (directories cannot be uploaded)');
        if (st.nlink > 1) return reject('is a hardlink and may reference a file outside the working directory');
        canonical.push(real);
      }

      if (args && canonical.length) {
        args.files = canonical;
        delete args.file;
        delete args.file_path;
      }
    }

    const timeout = method === 'ask_user' ? (args?.timeout || 120000) + 5000 :
                    method === 'solve_captcha' ? 60000 :
                    method === 'extract_list' ? 180000 : 30000;

    const result = await sendToExtension(method, args || {}, timeout);

    // Screenshot handling (saving to disk securely if requested)
    if (name === 'browser_screenshot' && result?.image) {
      const isJpeg = result.image.startsWith('data:image/jpeg');
      const prefix = isJpeg ? /^data:image\/jpeg;base64,/ : /^data:image\/png;base64,/;
      const mimeType = isJpeg ? 'image/jpeg' : 'image/png';
      const base64 = result.image.replace(prefix, '');

      if (args && args.path) {
        const root = resolve(process.cwd());
        const targetPath = resolve(root, args.path);
        if (targetPath !== root && !targetPath.startsWith(root.endsWith(sep) ? root : root + sep)) {
          throw new Error(`path must be inside working directory (${root}). "${args.path}" points outside.`);
        }

        const exists = (x) => { try { lstatSync(x); return true; } catch { return false; } };
        let rootReal = root;
        try { rootReal = realpathSync.native(root); } catch {}
        let ancestor = dirname(targetPath);
        while (!exists(ancestor) && dirname(ancestor) !== ancestor) ancestor = dirname(ancestor);
        let ancestorReal = null;
        try { ancestorReal = realpathSync.native(ancestor); } catch {}

        let isSymlink = false, multipleLinks = false;
        try {
          const st = lstatSync(targetPath);
          isSymlink = st.isSymbolicLink();
          multipleLinks = st.nlink > 1;
        } catch {}

        if (isSymlink || multipleLinks || !ancestorReal || (ancestorReal !== rootReal && !ancestorReal.startsWith(rootReal.endsWith(sep) ? rootReal : rootReal + sep))) {
          throw new Error(`path must be inside working directory (${root}). "${args.path}" points outside.`);
        }

        mkdirSync(dirname(targetPath), { recursive: true });
        writeFileSync(targetPath, Buffer.from(base64, 'base64'));
        return {
          content: [
            { type: 'text', text: `Screenshot successfully saved to: ${targetPath}` },
            { type: 'image', data: base64, mimeType }
          ]
        };
      }

      return { content: [{ type: 'image', data: base64, mimeType }] };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: explainMismatch(err.message) }],
      isError: true,
    };
  }
}
