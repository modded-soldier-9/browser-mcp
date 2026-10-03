/**
 * Browser MCP - WebSocket Bridge & Port Manager
 *
 * Connects AI agent MCP clients (stdio) to the Browser MCP Chrome extension via local WebSocket.
 * Discovers and binds available ports in the 9876-9895 range for isolated multi-session support.
 */

import { WebSocketServer } from 'ws';

export const BASE_PORT = Number(process.env.BROWSER_MCP_BASE_PORT) || 9876;
export const MAX_PORT = Number(process.env.BROWSER_MCP_MAX_PORT) || 9895;

export const connections = new Set();
let connSeq = 0;
let activePort = null;
let allPortsBusy = false;
let bindError = null;
let portBoundTime = 0;
let wss = null;
let cmdId = 0;
let lastActivity = Date.now();
const pending = new Map();

let lockedConnection = null;
let hasSentCommand = false;
const PINNED_EXTENSION = (process.env.BROWSER_MCP_EXTENSION_ID || '').trim() || null;

let portResolver = null;
let bindPromise = null;
let heartbeat = null;

export function cmpVersion(a, b) {
  const pa = String(a || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function liveConnections() {
  return [...connections].filter(c => c.ws.readyState === 1);
}

export function activeConnection() {
  if (lockedConnection && lockedConnection.ws.readyState === 1) return lockedConnection;

  let best = null;
  for (const c of liveConnections()) {
    if (!best) { best = c; continue; }
    const d = cmpVersion(c.version, best.version);
    if (d > 0 || (d === 0 && c.since > best.since)) best = c;
  }
  lockedConnection = best;
  return best;
}

export function distinctExtensions() {
  const byKey = new Map();
  for (const c of liveConnections()) {
    const key = c.extensionId || `legacy:${c.seq}`;
    if (!byKey.has(key)) byKey.set(key, c);
  }
  return [...byKey.values()];
}

let lastConflictKey = '';
export function warnConflict() {
  const all = distinctExtensions();
  if (all.length < 2) return;
  const key = all.map(c => `${c.extensionId || 'unknown'}@${c.version || '?'}`).sort().join('|');
  if (key === lastConflictKey) return;
  lastConflictKey = key;
  const active = activeConnection();
  const canChoose = all.some(c => c.version);
  process.stderr.write(
    `[MCP] WARNING: ${all.length} Browser MCP extensions connected concurrently ` +
    `(${all.map(c => `${c.extensionId || 'unknown'}${c.version ? ' v' + c.version : ''}`).join(', ')}). ` +
    'They share tabs and state. ' +
    (canChoose
      ? `Routing commands to newest extension (${active?.extensionId}). `
      : `No extension reported a version; selection (${active?.extensionId}) is arbitrary. `) +
    'To resolve, disable duplicates in chrome://extensions.\n'
  );
}

function resolvePortPromise(ok) {
  if (!portResolver) return;
  const resolve = portResolver;
  portResolver = null;
  bindPromise = null;
  resolve(ok);
}

function rejectPending(reason) {
  for (const [, { reject, timer }] of pending) {
    clearTimeout(timer);
    try { reject(new Error(reason)); } catch {}
  }
  pending.clear();
}

export function createWSS(port = BASE_PORT) {
  const server = new WebSocketServer({
    host: '127.0.0.1',
    port,
    verifyClient: ({ origin }, accept) => {
      if (/^chrome-extension:\/\/[a-p]{32}$/.test(origin || '')) return accept(true);
      process.stderr.write(
        `[MCP] Rejected connection without valid chrome-extension Origin` +
        `${origin ? ` (got "${String(origin).slice(0, 60)}")` : ' (no Origin header)'}\n`,
      );
      accept(false, 401, 'only chrome extensions may connect');
    },
  });
  wss = server;

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (port < MAX_PORT) {
        process.stderr.write(`[MCP] Port ${port} in use, probing ${port + 1}...\n`);
        createWSS(port + 1);
      } else {
        allPortsBusy = true;
        process.stderr.write(`[MCP] All ports ${BASE_PORT}-${MAX_PORT} in use. Cannot bind.\n`);
        resolvePortPromise(false);
      }
    } else {
      bindError = err.message;
      process.stderr.write(`[MCP] WebSocket error: ${err.message}\n`);
      resolvePortPromise(false);
    }
  });

  server.on('connection', (ws, req) => {
    const origin = req?.headers?.origin || '';
    const fromOrigin = /^chrome-extension:\/\/([a-p]{32})$/.exec(origin)?.[1] || null;

    if (!fromOrigin) {
      process.stderr.write(
        '[MCP] Rejected connection without valid chrome-extension Origin: ' +
        (origin ? `"${origin.slice(0, 60)}"` : 'none') + '\n',
      );
      try { ws.close(1008, 'only chrome extensions may connect'); } catch {}
      return;
    }

    if (PINNED_EXTENSION && fromOrigin && fromOrigin !== PINNED_EXTENSION) {
      process.stderr.write(`[MCP] Rejected extension ${fromOrigin} - pinned to ${PINNED_EXTENSION}\n`);
      try { ws.close(1008, 'not the pinned extension'); } catch {}
      return;
    }

    const conn = {
      ws,
      seq: ++connSeq,
      extensionId: fromOrigin,
      version: null,
      name: null,
      greeted: false,
      since: Date.now()
    };
    connections.add(conn);
    if (!hasSentCommand) lockedConnection = null;
    process.stderr.write(`[MCP] Chrome extension connected on port ${port} (${fromOrigin})\n`);
    warnConflict();

    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return;

      if (msg.type === 'ping') {
        try { ws.send(JSON.stringify({ type: 'pong' })); } catch {}
        return;
      }
      if (msg.type === 'pong') return;

      if (msg.type === 'hello') {
        conn.greeted = true;
        conn.extensionId = fromOrigin;
        conn.version = msg.version || null;
        conn.name = msg.name || null;
        if (!hasSentCommand) lockedConnection = null;
        warnConflict();
        return;
      }

      if (msg.type === 'kode') {
        conn.code = msg.kode;
        return;
      }

      if (msg.id && pending.has(msg.id)) {
        const item = pending.get(msg.id);
        if (item.conn !== conn) return;
        pending.delete(msg.id);
        clearTimeout(item.timer);
        lastActivity = Date.now();
        if (msg.error) item.reject(new Error(msg.error));
        else item.resolve(msg.result);
      }
    });

    ws.on('error', (e) => {
      process.stderr.write(`[MCP] WebSocket client error: ${e?.message || e}\n`);
      try { ws.close(); } catch {}
    });

    ws.on('close', () => {
      connections.delete(conn);
      rejectPending('extension disconnected');
      process.stderr.write(`[MCP] Chrome extension disconnected (${liveConnections().length} remaining)\n`);
    });
  });

  server.on('listening', () => {
    activePort = port;
    portBoundTime = Date.now();
    process.stderr.write(`[MCP] WebSocket server listening on ws://127.0.0.1:${port}\n`);
    resolvePortPromise(true);
  });

  if (heartbeat) clearInterval(heartbeat);
  heartbeat = setInterval(() => {
    for (const c of liveConnections()) {
      try { c.ws.ping(); } catch {}
    }
  }, 12000);
}

export function releasePort(reason) {
  if (activePort === null) return;
  process.stderr.write(`[MCP] Releasing port ${activePort}: ${reason}\n`);
  if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
  const oldWss = wss;
  wss = null;
  activePort = null;
  lockedConnection = null;
  hasSentCommand = false;
  for (const c of connections) { try { c.ws.close(); } catch {} }
  connections.clear();
  try { oldWss?.close(); } catch {}
}

export function ensurePort() {
  if (activePort !== null) return Promise.resolve(true);
  if (bindPromise) return bindPromise;
  allPortsBusy = false;
  bindError = null;
  portBoundTime = 0;
  bindPromise = new Promise((res) => { portResolver = res; });

  const watchdog = setTimeout(() => {
    if (!portResolver) return;
    bindError = bindError || 'port bind timed out after 10s';
    process.stderr.write('[MCP] Port binding timed out - abandoning attempt\n');
    resolvePortPromise(false);
  }, 10000);
  bindPromise.finally(() => clearTimeout(watchdog));

  createWSS();
  return bindPromise;
}

export async function sendToExtension(method, params = {}, timeoutMs = 30000, _retries = 5, _extraRound = false, _doorOpenedNow = null) {
  await ensurePort();
  const doorOpenedNow = _doorOpenedNow !== null
    ? _doorOpenedNow
    : Boolean(portBoundTime && (Date.now() - portBoundTime) < 10000);

  const conn = activeConnection();
  if (!conn) {
    if (_retries > 0) {
      await new Promise(r => setTimeout(r, 1500));
      return sendToExtension(method, params, timeoutMs, _retries - 1, _extraRound, doorOpenedNow);
    }
    if (doorOpenedNow && !_extraRound) {
      return sendToExtension(method, params, timeoutMs, 5, true, doorOpenedNow);
    }
    if (doorOpenedNow) {
      throw new Error(
        `Port ${activePort} was opened ${Math.round((Date.now() - portBoundTime) / 1000)}s ago, ` +
        'and the extension has not connected yet. Check Chrome is running and Browser MCP is enabled.'
      );
    }
    if (bindError) {
      throw new Error(`The server could not open a port on 127.0.0.1 (${BASE_PORT}-${MAX_PORT}): ${bindError}`);
    }
    if (allPortsBusy) {
      throw new Error(`All ports ${BASE_PORT}-${MAX_PORT} are busy right now.`);
    }
    throw new Error(
      'Chrome extension not connected. Verify Browser MCP is enabled in chrome://extensions.'
    );
  }

  return new Promise((resolve, reject) => {
    const id = ++cmdId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${method}`));
    }, timeoutMs);

    pending.set(id, { resolve, reject, timer, conn });
    hasSentCommand = true;
    conn.ws.send(JSON.stringify({ id, method, params, pid: process.ppid }));
  });
}

export function getActivePort() { return activePort; }
export function isAllPortsBusy() { return allPortsBusy; }
export function getBindError() { return bindError; }
export function getLastActivity() { return lastActivity; }
