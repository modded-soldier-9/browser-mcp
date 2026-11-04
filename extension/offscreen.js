/**
 * Offscreen Document / Persistent WebSocket Bridge (multi-session)
 *
 * Scans loopback port range 9876-9895 and maintains connections to all active
 * Browser MCP servers. Each AI assistant session connects via its own port automatically.
 * Passes the port ID with every command so background.js can track tab ownership.
 *
 * Flow: MCP Server(s) <--WS--> offscreen.js <--chrome.runtime.sendMessage--> background.js --> Chrome APIs
 */

const CODE_FILES = ['background.js', 'offscreen.js'];

let codeHashCache = null;
async function calculateCodeHash() {
  if (codeHashCache) return codeHashCache;
  try {
    const parts = [];
    for (const file of CODE_FILES) {
      const resp = await fetch(chrome.runtime.getURL(file));
      parts.push(new Uint8Array(await resp.arrayBuffer()));
    }
    const combined = new Uint8Array(parts.reduce((total, p) => total + p.length, 0));
    let offset = 0;
    for (const p of parts) {
      combined.set(p, offset);
      offset += p.length;
    }
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', combined));
    codeHashCache = Array.from(digest.slice(0, 6)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    console.warn('[Offscreen] Could not calculate code hash:', e?.message || e);
  }
  return codeHashCache;
}

function getExtensionVersion() {
  try {
    const v = new URLSearchParams(location.search).get('v');
    if (v) return v;
  } catch {}
  try {
    return chrome.runtime?.getManifest?.()?.version || '2.1.0';
  } catch {
    return '2.1.0';
  }
}

let profileCache = null;
function getActiveProfile() {
  if (profileCache) return profileCache;
  try {
    const p = new URLSearchParams(location.search).get('profile') || new URLSearchParams(location.search).get('profil');
    if (p && p.trim()) {
      profileCache = p.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
      return profileCache;
    }
  } catch {}
  return 'default';
}

chrome.runtime?.onMessage?.addListener((msg) => {
  if (msg?.type === 'bmcp_set_profile' && msg.profile) {
    profileCache = String(msg.profile).trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'default';
  }
});

function getPortRange() {
  try {
    const v = new URLSearchParams(location.search).get('porte') || new URLSearchParams(location.search).get('ports');
    const m = /^(\d{4,5})-(\d{4,5})$/.exec(v || '');
    if (m) {
      const from = Number(m[1]), to = Number(m[2]);
      if (from >= 1024 && to <= 65535 && to >= from && to - from < 200) return [from, to];
    }
  } catch {}
  return [9876, 9895];
}

const [BASE_PORT, MAX_PORT] = getPortRange();
const connections = new Map(); // port -> WebSocket

const PROBE_TIMEOUT_MS = 800;
let isScanning = false;

async function hasServer(port) {
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: 'no-store',
    });
    return resp.status === 426; // WebSocket server response to standard HTTP GET
  } catch {
    return false; // Connection rejected, timed out, or no server listening
  }
}

const SCAN_MAX_MS = 15000;
const inFlightProbes = new Set();

async function scanPorts() {
  if (isScanning) return;
  isScanning = true;
  const safetyTimeout = setTimeout(() => { isScanning = false; }, SCAN_MAX_MS);

  try {
    const candidates = [];
    for (let port = BASE_PORT; port <= MAX_PORT; port++) {
      const existing = connections.get(port);
      if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
        continue;
      }
      candidates.push(port);
    }
    if (!candidates.length) return;

    const newCandidates = candidates.filter((p) => !inFlightProbes.has(p));
    for (const p of newCandidates) inFlightProbes.add(p);

    const livePorts = await Promise.all(
      newCandidates.map(async (port) => {
        try {
          return (await hasServer(port)) ? port : null;
        } finally {
          inFlightProbes.delete(port);
        }
      }),
    );

    for (const port of livePorts) {
      if (port !== null) tryConnect(port);
    }
    if (typeof updateStatus === 'function') updateStatus();
  } finally {
    clearTimeout(safetyTimeout);
    isScanning = false;
  }
}

function tryConnect(port) {
  let ws;
  try {
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
  } catch {
    return;
  }

  connections.set(port, ws);

  const connectTimeout = setTimeout(() => {
    if (ws.readyState !== WebSocket.OPEN) ws.close();
  }, 8000);

  ws.onopen = async () => {
    clearTimeout(connectTimeout);
    connections.set(port, ws);

    const code = codeHashCache;
    let greeting = {
      type: 'hello',
      extensionId: chrome.runtime?.id || null,
      version: getExtensionVersion(),
      name: 'browser-mcp-extension',
      code,
      profile: getActiveProfile(),
    };

    try {
      ws.send(JSON.stringify(greeting));
    } catch (e) {
      console.warn('[Offscreen] Could not send handshake:', e?.message || e);
    }

    if (!code) {
      calculateCodeHash().then((hash) => {
        if (!hash || ws.readyState !== WebSocket.OPEN) return;
        try {
          ws.send(JSON.stringify({ type: 'code', code: hash }));
        } catch (e) {
          console.warn('[Offscreen] Could not send code hash:', e?.message || e);
        }
      });
    }

    console.log(`[Offscreen] Connected to Browser MCP server on port ${port} (${connections.size} total)`);
    updateStatus();
  };

  ws.onmessage = async (event) => {
    let cmd;
    try {
      cmd = JSON.parse(event.data);
    } catch {
      return;
    }

    if (!cmd || typeof cmd !== 'object') return;
    if (cmd.type === 'ping') {
      try { ws.send(JSON.stringify({ type: 'pong' })); } catch {}
      return;
    }
    if (cmd.type === 'pong') return;

    if (typeof cmd.method !== 'string') return;

    const { id, method, params, pid, agent, agentId } = cmd;

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'mcp_command',
        port,
        pid,
        agent,
        agentId,
        method,
        params: params || {},
      });

      if (result && result.__error) {
        ws.send(JSON.stringify({ id, error: result.__error }));
      } else {
        ws.send(JSON.stringify({ id, result }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ id, error: err.message || String(err) }));
    }
  };

  ws.onclose = () => {
    clearTimeout(connectTimeout);
    if (connections.get(port) === ws) {
      connections.delete(port);
      console.log(`[Offscreen] Disconnected from port ${port} (${connections.size} remaining)`);
      updateStatus();
      chrome.runtime.sendMessage({ type: 'session_disconnect', port }).catch(() => {});
      setTimeout(scanPorts, 500);
    }
  };

  ws.onerror = () => {
    clearTimeout(connectTimeout);
    ws.close();
  };
}

function updateStatus() {
  const count = connections.size;
  chrome.runtime.sendMessage({
    type: 'ws_status',
    connected: count > 0,
    count,
    ports: [...connections.keys()],
  }).catch(() => {});
}

// Heartbeat listener
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'bmcp_ping') return;
  sendResponse({ ok: true, version: getExtensionVersion() });
  return true;
});

// Terminate session signal handler
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'terminate_mcp_session' || typeof msg.port !== 'number') return;
  const ws = connections.get(msg.port);
  if (!ws) return;
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'terminate' }));
    }
  } catch {}
});

// Port scan trigger listener
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'bmcp_scan_now') {
    scanPorts();
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === 'bmcp_get_status') {
    updateStatus();
    sendResponse({
      ok: true,
      connected: connections.size > 0,
      count: connections.size,
      ports: [...connections.keys()],
    });
    return true;
  }
});

// Periodic keep-alive ping to servers
setInterval(() => {
  for (const [, ws] of connections) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: 'ping' })); } catch {}
    }
  }
}, 12000);

// Keep background service worker active while connections exist
setInterval(() => {
  if (connections.size > 0) {
    chrome.runtime.sendMessage({ type: 'bmcp_keepalive' }).catch(() => {});
  }
}, 20000);

// Initial scan + periodic scan for new servers
scanPorts();
setInterval(scanPorts, 2000);
