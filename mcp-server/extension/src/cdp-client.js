/**
 * Browser MCP - Chrome DevTools Protocol (CDP) Client
 *
 * Manages debugger attachment, command timeouts, transient reload recovery,
 * and command dispatching via chrome.debugger.
 */

const attachedTabs = new Set();
const debuggerCommandTimeouts = {
  'Input.dispatchMouseEvent': 4000,
  'Input.dispatchKeyEvent': 4000,
  'Runtime.evaluate': 10000,
  default: 20000,
};

export async function attachDebugger(tabId) {
  if (attachedTabs.has(tabId)) return;

  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await chrome.debugger.attach({ tabId }, '1.3');
      attachedTabs.add(tabId);
      return;
    } catch (err) {
      lastError = err;
      const msg = err?.message || String(err);

      if (/already attached/i.test(msg)) {
        attachedTabs.add(tabId);
        return;
      }

      // Handle transient page reloads
      if (/ghost|not attached|Cannot attach/i.test(msg)) {
        try { await chrome.debugger.detach({ tabId }); } catch {}
        await new Promise(r => setTimeout(r, 400 * attempt));
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Debugger attach failed after ${maxRetries} attempts: ${lastError?.message || lastError}`);
}

export async function detachDebugger(tabId) {
  if (!attachedTabs.has(tabId)) return;
  attachedTabs.delete(tabId);
  try {
    await chrome.debugger.detach({ tabId });
  } catch {}
}

const lastTabFocusAt = new Map();
try {
  chrome.tabs?.onActivated?.addListener(() => lastTabFocusAt.clear());
  chrome.windows?.onFocusChanged?.addListener(() => lastTabFocusAt.clear());
} catch {}

export async function ensureForegroundExecution(tabId) {
  const now = Date.now();
  if (now - (lastTabFocusAt.get(tabId) || 0) < 1500) return;
  try {
    await chrome.tabs.update(tabId, { active: true }).catch(() => null);
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab && tab.windowId !== undefined) {
      const win = await chrome.windows.get(tab.windowId).catch(() => null);
      if (win && (win.state === 'minimized' || !win.focused)) {
        await chrome.windows.update(tab.windowId, {
          focused: true,
          ...(win.state === 'minimized' ? { state: 'normal' } : {}),
        }).catch(() => null);
      }
    }
    if (attachedTabs.has(tabId)) {
      await chrome.debugger.sendCommand({ tabId }, 'Page.bringToFront', {}).catch(() => null);
    }
    lastTabFocusAt.set(tabId, Date.now());
  } catch {}
}

export async function sendCommand(tabId, method, params = {}) {
  await attachDebugger(tabId);
  if (method.startsWith('Input.')) {
    await ensureForegroundExecution(tabId);
  }
  const timeoutMs = debuggerCommandTimeouts[method] || debuggerCommandTimeouts.default;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`CDP command timed out after ${timeoutMs}ms: ${method}`));
    }, timeoutMs);

    chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

export function isAttached(tabId) {
  return attachedTabs.has(tabId);
}
