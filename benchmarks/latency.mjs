/**
 * Measures actual round-trip latency per MCP tool against a running Chrome instance.
 *
 * Tools test different execution layers:
 *   list_tabs        = transport baseline (stdio -> Rust server -> WebSocket -> extension -> response)
 *   get_page_content = + script injection and DOM tree extraction
 *   screenshot       = + frame capture
 *   navigate         = + full page navigation and DOM ready state
 *   scroll / click   = + CDP debugger connection + post-action settle
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const isWin = process.platform === 'win32';
const binName = isWin ? 'browser-mcp.exe' : 'browser-mcp';
const rootDir = fileURLToPath(new URL('..', import.meta.url));
const defaultBin = join(rootDir, 'target', 'release', binName);
const srvBin = process.env.BROWSER_MCP_BIN || defaultBin;

if (!existsSync(srvBin)) {
  console.error(`Binary not found at ${srvBin}. Run 'cargo build --release' first.`);
  process.exit(1);
}

const ROUNDS = Number(process.env.ROUNDS || 5);
const TARGET_PAGE = process.env.URL || 'https://example.com';

const p = spawn(srvBin, [], { stdio: ['pipe', 'pipe', 'pipe'] });
p.stderr.on('data', () => {});
let n = 0;
const pending = new Map();
let buf = '';

p.stdout.on('data', (d) => {
  buf += d;
  const lines = buf.split('\n');
  buf = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    let m;
    try {
      m = JSON.parse(line);
    } catch {
      continue;
    }
    const resolve = pending.get(m.id);
    if (resolve) {
      pending.delete(m.id);
      resolve(m);
    }
  }
});

const callRpc = (method, params, ms = 60000) => {
  const id = ++n;
  p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  return new Promise((res) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      res({ error: 'TIMEOUT' });
    }, ms);
    pending.set(id, (m) => {
      clearTimeout(timer);
      res(m);
    });
  });
};

const callTool = (name, args = {}) => callRpc('tools/call', { name, arguments: args });
const extractText = (r) => r?.result?.content?.[0]?.text ?? JSON.stringify(r);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function measureTool(name, args) {
  const t0 = process.hrtime.bigint();
  const r = await callTool(name, args);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { ms, text: extractText(r).replace(/\s+/g, ' ').slice(0, 90) };
}

function calculateStats(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  return {
    n: sorted.length,
    min: sorted[0],
    med: sorted[Math.floor(sorted.length / 2)],
    max: sorted[sorted.length - 1],
  };
}

(async () => {
  await callRpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'benchmark-latency', version: '2.1.0' },
  });
  p.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  await sleep(300);

  const cold = await measureTool('browser_list_tabs', {});
  console.log(`Cold start (first call):     ${cold.ms.toFixed(0)} ms`);
  const firstNav = await measureTool('browser_navigate', { url: TARGET_PAGE, new_tab: true });
  console.log(`First navigate (new tab):    ${firstNav.ms.toFixed(0)} ms`);
  console.log(`Target page:                 ${TARGET_PAGE}\n`);

  const plan = [
    ['browser_list_tabs', {}],
    ['browser_get_page_content', {}],
    ['browser_screenshot', {}],
    ['browser_navigate', { url: TARGET_PAGE }],
    ['browser_scroll', { y: 300 }],
    ['browser_wait', { selector: 'body', timeout: 3000 }],
    ['browser_console_logs', {}],
    ['browser_get_cookies', {}],
  ];

  const results = {};
  const lastResponses = {};

  for (let r = 0; r < ROUNDS; r++) {
    for (const [name, args] of plan) {
      const res = await measureTool(name, args);
      (results[name] ||= []).push(res.ms);
      lastResponses[name] = res.text;
    }
  }

  console.log('Tool'.padEnd(28) + '  n     min   median      max   (ms)');
  for (const [name, times] of Object.entries(results)) {
    const s = calculateStats(times);
    console.log(
      name.padEnd(28) +
        `  ${s.n}  ${s.min.toFixed(0).padStart(6)}  ${s.med.toFixed(0).padStart(6)}  ${s.max.toFixed(0).padStart(7)}`
    );
  }

  console.log('\nLast response sample:');
  for (const [name, text] of Object.entries(lastResponses)) {
    console.log('  ' + name.padEnd(26) + text);
  }

  const tabsRes = JSON.parse(extractText(await callTool('browser_list_tabs')));
  for (const tab of tabsRes.tabs || []) {
    await callTool('browser_close_tab', { tab_id: tab.id });
  }

  p.kill();
  process.exit(0);
})();
