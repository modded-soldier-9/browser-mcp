/**
 * Browser MCP - DOM Inspector & Content Extractor
 *
 * Reads page text, HTML, and lists. Handles virtualized scrolling
 * and selector evaluation across standard and Shadow DOM nodes.
 */

import { sendCommand } from './cdp-client.js';

export async function evaluateScript(tabId, code) {
  const result = await sendCommand(tabId, 'Runtime.evaluate', {
    expression: code,
    returnByValue: true,
    awaitPromise: true,
  });

  if (result.exceptionDetails) {
    const desc = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
    throw new Error(`Script error: ${desc}`);
  }

  return result.result?.value;
}

export async function getPageContent(tabId, { selector = null, format = 'text', max_chars = 30000 } = {}) {
  const code = `
    (() => {
      const root = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : 'document.body'};
      if (!root) return { error: 'selector not found' };
      const raw = ${format === 'html' ? 'root.outerHTML' : 'root.innerText'};
      const truncated = raw.length > ${max_chars};
      return {
        content: truncated ? raw.slice(0, ${max_chars}) : raw,
        total_chars: raw.length,
        truncated,
      };
    })()
  `;

  const res = await evaluateScript(tabId, code);
  if (res?.error) throw new Error(`Element matching "${selector}" was not found.`);
  return res;
}

export async function extractList(tabId, { selector, container = null, max_rows = 500, wait_ms = 350, stable_rounds = 3 } = {}) {
  const code = `
    (async () => {
      const rowSelector = ${JSON.stringify(selector)};
      const containerSelector = ${JSON.stringify(container)};
      const targetContainer = containerSelector ? document.querySelector(containerSelector) : (document.querySelector(rowSelector)?.closest('[style*="overflow"], [class*="overflow"]') || window);

      const seen = new Set();
      let stableCount = 0;
      let lastCount = 0;

      while (seen.size < ${max_rows} && stableCount < ${stable_rounds}) {
        const rows = document.querySelectorAll(rowSelector);
        for (const r of rows) {
          const txt = r.innerText.trim();
          if (txt) seen.add(txt);
        }

        if (seen.size === lastCount) {
          stableCount++;
        } else {
          stableCount = 0;
          lastCount = seen.size;
        }

        if (targetContainer.scrollBy) {
          targetContainer.scrollBy(0, 400);
        } else if (window.scrollBy) {
          window.scrollBy(0, 400);
        }

        await new Promise(r => setTimeout(r, ${wait_ms}));
      }

      return {
        rows: Array.from(seen),
        total: seen.size,
        reached_end: stableCount >= ${stable_rounds},
      };
    })()
  `;

  return await evaluateScript(tabId, code);
}
