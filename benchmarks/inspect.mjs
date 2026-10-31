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

const callRpc = (method, params, ms = 45000) => {
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

(async () => {
  await callRpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'benchmark-inspect', version: '2.1.0' },
  });
  p.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  await sleep(300);

  console.log('--- browser_about ---');
  console.log(extractText(await callTool('browser_about', {})));

  console.log('\n--- browser_navigate ---');
  console.log(extractText(await callTool('browser_navigate', { url: 'https://example.com', new_tab: true })).slice(0, 300));

  console.log('\n--- browser_get_page_content ---');
  console.log(extractText(await callTool('browser_get_page_content', {})).slice(0, 500));

  const t0 = Date.now();
  console.log('\n--- browser_scroll ---');
  console.log(extractText(await callTool('browser_scroll', { y: 200 })).slice(0, 300) + `  [${Date.now() - t0} ms]`);

  console.log('\n--- browser_list_tabs ---');
  console.log(extractText(await callTool('browser_list_tabs', {})).slice(0, 500));

  p.kill();
  process.exit(0);
})();
