/**
 * Browser MCP - Dialog & Overlay Manager
 *
 * Manages human-in-the-loop prompts (ask_user), JavaScript dialog handling
 * (alert/confirm/prompt), CAPTCHA detection, and automated overlay dismissal.
 */

import { sendCommand } from './cdp-client.js';

let armedDialogAction = null;
let armedDialogText = null;

export function armDialog({ action = 'accept', text = '' } = {}) {
  armedDialogAction = action;
  armedDialogText = text;
  return { ok: true, armed: true, action };
}

export async function handleDialogEvent(tabId, params) {
  const action = armedDialogAction || 'accept';
  const promptText = armedDialogText || undefined;
  armedDialogAction = null;
  armedDialogText = null;

  await sendCommand(tabId, 'Page.handleJavaScriptDialog', {
    accept: action === 'accept',
    promptText,
  });

  return { ok: true, handled: true, action, message: params.message };
}

export async function askUser(tabId, { title = 'Browser MCP - Action Required', message, fields = [], timeout = 120000 } = {}) {
  return new Promise(async (resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`ask_user dialog timed out after ${timeout}ms`));
    }, timeout);

    try {
      const code = `
        (() => {
          const overlayId = 'bmcp-ask-user-overlay';
          const existing = document.getElementById(overlayId);
          if (existing) existing.remove();

          const overlay = document.createElement('div');
          overlay.id = overlayId;
          overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#f1f5f9;pointer-events:none;';

          const card = document.createElement('div');
          card.style.cssText = 'background:#111827;border:1px solid rgba(255,255,255,0.12);box-shadow:0 20px 40px rgba(0,0,0,0.5);border-radius:12px;padding:22px;width:380px;max-width:90vw;display:flex;flex-direction:column;gap:14px;pointer-events:auto;';

          const titleEl = document.createElement('h3');
          titleEl.textContent = ${JSON.stringify(title)};
          titleEl.style.cssText = 'margin:0;font-size:15px;font-weight:600;color:#38bdf8;';
          card.appendChild(titleEl);

          const msgEl = document.createElement('p');
          msgEl.textContent = ${JSON.stringify(message)};
          msgEl.style.cssText = 'margin:0;font-size:13px;line-height:1.5;color:#cbd5e1;';
          card.appendChild(msgEl);

          const form = document.createElement('form');
          form.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

          const fieldInputs = {};
          const fieldsData = ${JSON.stringify(fields)};
          fieldsData.forEach(f => {
            const label = document.createElement('label');
            label.textContent = f.label;
            label.style.cssText = 'font-size:11px;font-weight:600;color:#94a3b8;display:flex;flex-direction:column;gap:4px;';

            const input = document.createElement('input');
            input.type = f.type || 'text';
            input.name = f.name;
            input.style.cssText = 'background:#1f2937;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px 10px;color:#fff;font-size:13px;outline:none;';
            label.appendChild(input);
            form.appendChild(label);
            fieldInputs[f.name] = input;
          });

          const btnRow = document.createElement('div');
          btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:6px;';

          const submitBtn = document.createElement('button');
          submitBtn.type = 'submit';
          submitBtn.textContent = 'Submit';
          submitBtn.style.cssText = 'background:#0284c7;border:none;border-radius:6px;color:#fff;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;';
          btnRow.appendChild(submitBtn);
          form.appendChild(btnRow);

          card.appendChild(form);
          overlay.appendChild(card);
          document.body.appendChild(overlay);

          return new Promise((res) => {
            form.onsubmit = (e) => {
              e.preventDefault();
              const result = {};
              fieldsData.forEach(f => {
                result[f.name] = fieldInputs[f.name]?.value || '';
              });
              overlay.remove();
              res(result);
            };
          });
        })()
      `;

      chrome.scripting.executeScript(
        { target: { tabId }, func: (c) => eval(c), args: [code] },
        (results) => {
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(results?.[0]?.result || {});
          }
        }
      );
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}

export async function detectCaptcha(tabId) {
  const code = `
    (() => {
      const isReCaptcha = Boolean(document.querySelector('.g-recaptcha, iframe[src*="recaptcha"]'));
      const isHCaptcha = Boolean(document.querySelector('.h-captcha, iframe[src*="hcaptcha"]'));
      const isTurnstile = Boolean(document.querySelector('.cf-turnstile, iframe[src*="challenges.cloudflare.com"]'));
      return {
        detected: isReCaptcha || isHCaptcha || isTurnstile,
        type: isReCaptcha ? 'recaptcha' : isHCaptcha ? 'hcaptcha' : isTurnstile ? 'turnstile' : null,
      };
    })()
  `;

  return new Promise((resolve) => {
    chrome.scripting.executeScript(
      { target: { tabId }, func: (c) => eval(c), args: [code] },
      (results) => {
        resolve(results?.[0]?.result || { detected: false, type: null });
      }
    );
  });
}
