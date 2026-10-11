/**
 * Direct CDP Browser Automation Engine for Brave / Chromium
 *
 * Connects directly to Chromium via Chrome DevTools Protocol (CDP) over HTTP/WebSocket.
 * Eliminates the need for any MV3 browser extensions, background service workers,
 * or extension reloads. Supports true concurrent multi-agent workflows.
 */

import http from 'node:http';
import { WebSocket } from 'ws';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const BRAVE_EXE_PATHS = [
  'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  `${process.env.LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
  `${process.env.PROGRAMFILES}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
];

export class DirectCdpBrowser {
  constructor(options = {}) {
    this.port = options.port || 9222;
    this.host = options.host || '127.0.0.1';
    this.agentSessions = new Map(); // agentId -> tabTarget
    this.activeTabs = new Map(); // tabId -> { ws, target, messageCallbacks, nextId }
  }

  get cdpBaseUrl() {
    return `http://${this.host}:${this.port}`;
  }

  findBraveBinary() {
    for (const p of BRAVE_EXE_PATHS) {
      if (p && existsSync(p)) return p;
    }
    return null;
  }

  async isCdpReachable() {
    return new Promise((resolve) => {
      const req = http.get(`${this.cdpBaseUrl}/json/version`, { timeout: 1500 }, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  async ensureBrowserRunning() {
    const reachable = await this.isCdpReachable();
    if (reachable) return true;

    const braveBin = this.findBraveBinary();
    if (!braveBin) {
      throw new Error('Brave Browser executable not found in standard paths.');
    }

    // Launch Brave with remote debugging port enabled
    const userDataDir = `${process.env.LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\User Data-CDP`;
    const args = [
      `--remote-debugging-port=${this.port}`,
      '--remote-allow-origins=*',
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ];

    const proc = spawn(braveBin, args, {
      detached: true,
      stdio: 'ignore',
    });
    proc.unref();

    // Poll until CDP is available (up to 10 seconds)
    const startTime = Date.now();
    while (Date.now() - startTime < 10000) {
      await new Promise((r) => setTimeout(r, 400));
      if (await this.isCdpReachable()) return true;
    }

    throw new Error(`Failed to connect to Brave on port ${this.port} after launching.`);
  }

  async httpJson(endpoint, method = 'GET') {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.cdpBaseUrl);
      const req = http.request(url, { method, timeout: 5000 }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : null);
          } catch (e) {
            resolve(body);
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout requesting ${endpoint}`));
      });
      req.end();
    });
  }

  async listTabs() {
    await this.ensureBrowserRunning();
    const targets = await this.httpJson('/json/list');
    return (targets || []).filter((t) => t.type === 'page');
  }

  async newTab(url = 'about:blank', agentId = null) {
    await this.ensureBrowserRunning();
    const encoded = encodeURIComponent(url);
    const target = await this.httpJson(`/json/new?${encoded}`, 'PUT');
    if (agentId && target?.id) {
      this.agentSessions.set(agentId, target.id);
    }
    return target;
  }

  async closeTab(tabId) {
    await this.ensureBrowserRunning();
    await this.httpJson(`/json/close/${tabId}`);
    const active = this.activeTabs.get(tabId);
    if (active && active.ws) {
      try { active.ws.close(); } catch {}
      this.activeTabs.delete(tabId);
    }
  }

  async activateTab(tabId) {
    await this.ensureBrowserRunning();
    await this.httpJson(`/json/activate/${tabId}`);
  }

  async connectToTab(tabId) {
    const existing = this.activeTabs.get(tabId);
    if (existing && existing.ws && existing.ws.readyState === WebSocket.OPEN) {
      return existing;
    }

    const tabs = await this.listTabs();
    const target = tabs.find((t) => t.id === tabId);
    if (!target || !target.webSocketDebuggerUrl) {
      throw new Error(`Tab ${tabId} not found or missing debugger URL.`);
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(target.webSocketDebuggerUrl);
      const session = {
        ws,
        target,
        nextId: 0,
        callbacks: new Map(),
      };

      ws.on('open', () => {
        this.activeTabs.set(tabId, session);
        resolve(session);
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.id != null && session.callbacks.has(msg.id)) {
            const cb = session.callbacks.get(msg.id);
            session.callbacks.delete(msg.id);
            if (msg.error) {
              cb.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            } else {
              cb.resolve(msg.result);
            }
          }
        } catch {}
      });

      ws.on('error', (err) => {
        if (!this.activeTabs.has(tabId)) reject(err);
      });

      ws.on('close', () => {
        this.activeTabs.delete(tabId);
      });
    });
  }

  async sendCdp(tabId, method, params = {}) {
    const session = await this.connectToTab(tabId);
    const id = ++session.nextId;

    return new Promise((resolve, reject) => {
      session.callbacks.set(id, { resolve, reject });
      try {
        session.ws.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        session.callbacks.delete(id);
        reject(err);
      }
    });
  }

  async getTabForAgent(agentId = null, explicitTabId = null) {
    if (explicitTabId) return explicitTabId;
    if (agentId && this.agentSessions.has(agentId)) {
      const id = this.agentSessions.get(agentId);
      const tabs = await this.listTabs();
      if (tabs.some((t) => t.id === id)) return id;
    }
    const tabs = await this.listTabs();
    if (tabs.length > 0) return tabs[0].id;
    const newPage = await this.newTab('about:blank', agentId);
    return newPage.id;
  }

  // High-level Actions
  async navigate(url, { agentId = null, explicitTabId = null, newTab = false } = {}) {
    await this.ensureBrowserRunning();
    let tabId;
    if (newTab) {
      const page = await this.newTab(url, agentId);
      tabId = page.id;
    } else {
      tabId = await this.getTabForAgent(agentId, explicitTabId);
      await this.sendCdp(tabId, 'Page.navigate', { url });
    }
    return { ok: true, tab_id: tabId, url, agent_id: agentId };
  }

  async getPageContent(tabId, { selector = null, format = 'text', max_chars = 30000 } = {}) {
    const code = `
      (() => {
        const root = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : 'document.documentElement'};
        if (!root) return { error: 'selector not found' };
        let raw = ${format === 'html' ? 'root.outerHTML' : '(root.innerText || "")'};
        ${!selector && format === 'text' ? `
          try {
            const iframes = Array.from(document.querySelectorAll('iframe'));
            for (const f of iframes) {
              try {
                const doc = f.contentDocument || f.contentWindow?.document;
                if (doc && doc.body) {
                  const txt = (doc.body.innerText || '').trim();
                  if (txt) {
                    const src = f.getAttribute('src') || f.title || 'iframe';
                    raw += '\\n\\n--- [Frame: ' + src + '] ---\\n' + txt;
                  }
                }
              } catch {}
            }
          } catch {}
        ` : ''}
        const truncated = raw.length > ${max_chars};
        return {
          content: truncated ? raw.slice(0, ${max_chars}) : raw,
          total_chars: raw.length,
          truncated,
          title: document.title,
          url: location.href
        };
      })()
    `;

    const res = await this.evaluate(tabId, code);
    if (res?.error) throw new Error(res.error);
    return res;
  }

  async evaluate(tabId, code) {
    let normalized = code.trim();
    const needsAsyncWrapper = /\b(await|const|let|var|return|if|for|while)\b/.test(normalized) &&
      !/^\s*\(\s*(async\s*)?\(\s*\)\s*=>\s*\{[\s\S]*\}\s*\)\s*\(\s*\)\s*;?\s*$/.test(normalized);
    if (needsAsyncWrapper) {
      normalized = `(async () => {\n${normalized}\n})()`;
    }

    const res = await this.sendCdp(tabId, 'Runtime.evaluate', {
      expression: normalized,
      returnByValue: true,
      awaitPromise: true,
    });

    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res.result?.value;
  }

  async screenshot(tabId) {
    const res = await this.sendCdp(tabId, 'Page.captureScreenshot', { format: 'png' });
    return res.data;
  }

  async click(tabId, selector) {
    // Resolve element coordinates in page context, including label fallback
    const resolveCode = `
      (() => {
        let el;
        const sel = ${JSON.stringify(selector)};
        if (sel.startsWith('text=')) {
          const text = sel.slice(5).trim();
          el = Array.from(document.querySelectorAll('button, a, [role="button"], input, label, span, div, p, li, td'))
            .find(e => (e.textContent || '').trim() === text);
        } else {
          el = document.querySelector(sel);
        }
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) {
          let label = el.id ? document.querySelector('label[for="' + CSS.escape(el.id) + '"]') : null;
          if (!label) label = el.closest ? el.closest('label') : null;
          if (!label && el.parentElement) label = el.parentElement.querySelector('label');
          if (label) {
            const lr = label.getBoundingClientRect();
            if (lr.width > 0 && lr.height > 0) el = label;
          }
        }
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        const box = el.getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2, tag: el.tagName };
      })()
    `;

    const coords = await this.evaluate(tabId, resolveCode);
    if (!coords) throw new Error(`Element matching "${selector}" not found.`);

    await this.sendCdp(tabId, 'Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: coords.x,
      y: coords.y,
      button: 'left',
      clickCount: 1,
    });
    await this.sendCdp(tabId, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: coords.x,
      y: coords.y,
      button: 'left',
      clickCount: 1,
    });

    return { ok: true, tag: coords.tag, x: coords.x, y: coords.y };
  }

  async fill(tabId, selector, value) {
    await this.click(tabId, selector);
    const fillCode = `
      (() => {
        const sel = ${JSON.stringify(selector)};
        const el = sel.startsWith('text=')
          ? Array.from(document.querySelectorAll('input, textarea')).find(e => (e.placeholder || '').includes(sel.slice(5).trim()))
          : document.querySelector(sel);
        if (!el) return false;
        el.focus();
        el.value = ${JSON.stringify(value)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `;
    await this.evaluate(tabId, fillCode);
    return { ok: true, value };
  }
}
