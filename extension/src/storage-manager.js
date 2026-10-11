/**
 * Browser MCP - Storage & Cookies Manager
 *
 * Handles reading and writing cookies via chrome.cookies API and
 * localStorage key/value inspection via evaluated page scripts.
 */

export async function getCookies(domain) {
  return new Promise((resolve, reject) => {
    chrome.cookies.getAll({ domain }, (cookies) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(cookies || []);
      }
    });
  });
}

export async function setCookie(cookie) {
  return new Promise((resolve, reject) => {
    chrome.cookies.set(cookie, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(res);
      }
    });
  });
}

export async function setCookies(cookies) {
  const list = Array.isArray(cookies) ? cookies : [cookies];
  const results = [];
  for (const c of list) {
    results.push(await setCookie(c));
  }
  return results;
}

export async function getLocalStorage(tabId, key = null) {
  const code = `
    (() => {
      if (${key ? JSON.stringify(key) : 'null'}) {
        return window.localStorage.getItem(${JSON.stringify(key)});
      }
      const all = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        all[k] = window.localStorage.getItem(k);
      }
      return all;
    })()
  `;

  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      { target: { tabId }, func: (c) => eval(c), args: [code] },
      (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(results?.[0]?.result);
        }
      }
    );
  });
}

export async function setLocalStorage(tabId, key, value) {
  const code = `
    (() => {
      window.localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)});
      return { ok: true, key: ${JSON.stringify(key)} };
    })()
  `;

  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      { target: { tabId }, func: (c) => eval(c), args: [code] },
      (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(results?.[0]?.result);
        }
      }
    );
  });
}
