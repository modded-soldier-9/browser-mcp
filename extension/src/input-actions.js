/**
 * Browser MCP - Input Actions
 *
 * Simulates trusted CDP mouse events, keyboard typing, scrolling, and keypresses
 * with full fallback support for Angular, React, Vue, and Shadow DOM components.
 */

import { sendCommand } from './cdp-client.js';

export async function clickXY(tabId, x, y, button = 'left') {
  const btn = button === 'right' ? 'right' : 'left';
  await sendCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: btn,
    clickCount: 1,
  });
  await sendCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: btn,
    clickCount: 1,
  });
  return { ok: true, x, y };
}

export async function doubleClickXY(tabId, x, y) {
  await clickXY(tabId, x, y, 'left');
  await sendCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 2,
  });
  await sendCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 2,
  });
  return { ok: true, x, y };
}

export async function hoverXY(tabId, x, y, durationMs = 500) {
  await sendCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x,
    y,
  });
  if (durationMs > 0) {
    await new Promise((r) => setTimeout(r, durationMs));
  }
  return { ok: true, x, y };
}

export async function scrollWindow(tabId, deltaX = 0, deltaY = 500, x = 100, y = 100) {
  await sendCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x,
    y,
    deltaX,
    deltaY,
  });
  return { ok: true, deltaX, deltaY };
}

export async function pressKey(tabId, key, modifiers = {}) {
  let modifierBitfield = 0;
  if (modifiers.alt) modifierBitfield |= 1;
  if (modifiers.ctrl) modifierBitfield |= 2;
  if (modifiers.meta) modifierBitfield |= 4;
  if (modifiers.shift) modifierBitfield |= 8;

  const code = modifiers.code || (key.length === 1 ? `Key${key.toUpperCase()}` : key);

  await sendCommand(tabId, 'Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key,
    code,
    modifiers: modifierBitfield,
  });

  if (key.length === 1) {
    await sendCommand(tabId, 'Input.dispatchKeyEvent', {
      type: 'char',
      text: key,
      unmodifiedText: key,
      modifiers: modifierBitfield,
    });
  }

  await sendCommand(tabId, 'Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code,
    modifiers: modifierBitfield,
  });

  return { ok: true, key };
}

export async function typeText(tabId, text) {
  for (const char of text) {
    await pressKey(tabId, char);
  }
  return { ok: true, textLength: text.length };
}

export function setControlledInputValue(element, value) {
  try {
    element.scrollIntoView({ block: 'center', behavior: 'instant' });
    element.focus();
  } catch {}

  if (element._valueTracker) {
    try { element._valueTracker.setValue(''); } catch {}
  }

  const proto = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }

  try {
    element.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: value }));
  } catch {
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }
  element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  return { ok: true, value };
}
