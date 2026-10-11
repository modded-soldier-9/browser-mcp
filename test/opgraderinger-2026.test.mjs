/**
 * Tests for Browser-MCP Upgrades:
 * 1. Label fallback for hidden checkboxes and toggles
 * 2. Seamless cross-session tab ownership adoption
 * 3. Iframe text traversal in get_page_content
 * 4. Top-level await and statement auto-wrapping in execute_script
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indlaesUdvidelse } from './hjaelp/udvidelses-sele.mjs';

test('switch_tab overdrager faner paent mellem sessioner i stedet for at kaste fejl', async () => {
  const fane1 = { id: 101, url: 'https://example.com/app', windowId: 1, active: false };
  const u = indlaesUdvidelse({
    svar: {
      'tabs.get': (id) => (id === 101 ? fane1 : Promise.reject(new Error('Tab not found'))),
      'tabs.update': (id, props) => Object.assign(fane1, props),
      'windows.update': () => ({}),
      'storage.local.set': () => ({}),
    },
  });

  const sessions = u.hent('sessions');
  // Session 1 (port 1000) ejer fane 101
  sessions.set(1000, {
    tabIds: new Set([101]),
    activeTabId: 101,
    label: 'Claude 1',
    color: 'blue',
  });

  // Session 2 (port 2000) kalder switch_tab for fane 101
  sessions.set(2000, {
    tabIds: new Set(),
    activeTabId: null,
    label: 'Claude 2',
    color: 'purple',
  });

  const dispatch = u.hent('dispatch');
  const svar = await dispatch(2000, 'switch_tab', { tab_id: 101 });

  assert.equal(svar.id, 101, 'Fanen skal aktiveres');
  assert.ok(sessions.get(2000).tabIds.has(101), 'Session 2 skal have adopteret fanen');
  assert.ok(!sessions.get(1000).tabIds.has(101), 'Session 1 har afgivet fanen');
});

test('close_tab adopterer og lukker en fane fra en forrige session uden fejl', async () => {
  const fane2 = { id: 202, url: 'https://example.com/admin', windowId: 1, active: false };
  let removed = false;
  const u = indlaesUdvidelse({
    svar: {
      'tabs.get': (id) => (id === 202 ? fane2 : Promise.reject(new Error('Tab not found'))),
      'tabs.remove': () => { removed = true; return {}; },
      'storage.local.set': () => ({}),
    },
  });

  const sessions = u.hent('sessions');
  sessions.set(1111, { tabIds: new Set([202]), activeTabId: 202, label: 'Claude 1', color: 'blue' });
  sessions.set(2222, { tabIds: new Set(), activeTabId: null, label: 'Claude 2', color: 'purple' });

  const dispatch = u.hent('dispatch');
  const svar = await dispatch(2222, 'close_tab', { tab_id: 202 });

  assert.equal(svar.ok, true);
  assert.equal(removed, true, 'Fanen skal vaere lukket');
  assert.ok(!sessions.get(1111).tabIds.has(202));
});
