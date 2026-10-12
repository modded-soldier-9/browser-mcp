/**
 * Test: Multi-Profile Routing via BROWSER_MCP_PROFILE
 *
 * Verifies that when multiple browser profiles have Browser MCP loaded,
 * servers configured with BROWSER_MCP_PROFILE bind to and communicate exclusively
 * with the matching profile, and fail gracefully with informative diagnostics
 * when the requested profile is not active.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rod = dirname(dirname(fileURLToPath(import.meta.url)));
const kilde = readFileSync(join(rod, 'mcp-server/index.js'), 'utf8');

function udtraek(navn) {
  const start = kilde.indexOf(`function ${navn}(`);
  if (start === -1) throw new Error(`${navn}() findes ikke i index.js`);
  let dybde = 0, i = kilde.indexOf('{', start);
  for (; i < kilde.length; i++) {
    if (kilde[i] === '{') dybde++;
    else if (kilde[i] === '}' && --dybde === 0) break;
  }
  return kilde.slice(start, i + 1);
}

function bygServer(oensketProfil = null) {
  const connections = new Set();
  const src = ['cmpVersion', 'liveConnections', 'activeConnection', 'distinctExtensions']
    .map(udtraek).join('\n\n');
  const fabrik = new Function('connections', 'OENSKET_PROFIL', `
    let laastForbindelse = null, harSendtKommando = false;
    const PARRINGSNOEGLE = null;
    ${src}
    return {
      cmpVersion, liveConnections, activeConnection, distinctExtensions,
      sendKommando: () => { harSendtKommando = true; },
      nulstilLaas: () => { laastForbindelse = null; }
    };`);
  return { connections, ...fabrik(connections, oensketProfil) };
}

const AABEN = 1;
let seq = 0;
const forbind = (connections, { version = '2.0.0', id = 'a'.repeat(32), profile = 'default', since = ++seq } = {}) => {
  const c = {
    ws: { readyState: AABEN, send: () => {} },
    seq: ++seq,
    extensionId: id,
    version,
    name: 'Browser MCP',
    profile,
    since,
  };
  connections.add(c);
  return c;
};

test('uden BROWSER_MCP_PROFILE vaelges default forbindelsen', () => {
  const s = bygServer(null);
  const c1 = forbind(s.connections, { profile: 'default' });
  assert.equal(s.activeConnection(), c1, 'serveren fandt ikke standardforbindelsen');
});

test('med BROWSER_MCP_PROFILE=work vaelges den matchende profil over personal', () => {
  const s = bygServer('work');
  const cPersonal = forbind(s.connections, { profile: 'personal' });
  const cWork = forbind(s.connections, { profile: 'work' });

  const valgt = s.activeConnection();
  assert.equal(valgt, cWork, 'serveren valgte ikke work-profilen');
  assert.notEqual(valgt, cPersonal, 'serveren faldt tilbage til personal-profilen');
});

test('profil-matchning er case-insensitive (Work == work)', () => {
  const s = bygServer('Work');
  const cWork = forbind(s.connections, { profile: 'work' });

  const valgt = s.activeConnection();
  assert.equal(valgt, cWork, 'case-insensitive match fejlede');
});

test('flere profiler med samme profilnavn vaelger den nyeste forbindelse', () => {
  const s = bygServer('clientA');
  const c1 = forbind(s.connections, { profile: 'clientA', since: 10 });
  const c2 = forbind(s.connections, { profile: 'clientA', since: 20 });

  const valgt = s.activeConnection();
  assert.equal(valgt, c2, 'nyeste forbindelse med oensket profil vandt ikke');
});

test('naar den oenskede profil mangler, returnerer liveConnections tomt array', () => {
  const s = bygServer('missing-profile');
  forbind(s.connections, { profile: 'personal' });
  forbind(s.connections, { profile: 'work' });

  assert.deepEqual(s.liveConnections(), [], 'uonskede profiler slap igennem filteret');
  assert.equal(s.activeConnection(), null, 'en uonsket profil blev fejlagtigt valgt som aktiv');
});

test('popup.html indeholder profil-inputfeltet', () => {
  const html = readFileSync(join(rod, 'extension/popup.html'), 'utf8');
  assert.ok(html.includes('id="profileInput"'), 'profileInput mangler i popup.html');
  assert.ok(html.includes('id="saveProfileBtn"'), 'saveProfileBtn mangler i popup.html');
});

test('offscreen.js sender profil i hello-haandtrykket', () => {
  const js = readFileSync(join(rod, 'extension/offscreen.js'), 'utf8');
  assert.match(js, /profile:\s*minProfil\(\)/, 'offscreen.js medsender ikke profile i hilsenen');
});

test('background.js videresender profil til offscreen URL', () => {
  const js = readFileSync(join(rod, 'extension/background.js'), 'utf8');
  assert.match(js, /profile=/i, 'background.js videresender ikke profile parameter i offscreen URL');
});
