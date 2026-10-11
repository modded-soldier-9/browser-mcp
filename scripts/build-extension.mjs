#!/usr/bin/env node

/**
 * Browser MCP - Extension Build & Synchronization Pipeline
 *
 * Verifies extension syntax, ensures byte-for-byte parity across source,
 * bundled distribution (mcp-server/extension), user runtime (~/.browser-mcp/extension),
 * and native JeikCode plugin directories.
 */

import { cpSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(__dirname); // browser-mcp/
const sourceDir = join(rootDir, 'extension');
const mcpServerExtDir = join(rootDir, 'mcp-server', 'extension');
const userExtDir = join(homedir(), '.browser-mcp', 'extension');
const pluginExtDir = join(homedir(), '.jeikcode', 'plugins', 'browser-mcp', 'extension');

console.log('=== Building & Synchronizing Browser MCP Extension ===\n');

// 1. Verify Source Files
const requiredFiles = ['manifest.json', 'background.js', 'offscreen.js', 'popup.html', 'popup.js'];
for (const file of requiredFiles) {
  const p = join(sourceDir, file);
  if (!existsSync(p)) {
    console.error(`❌ Missing essential source file: ${file}`);
    process.exit(1);
  }
}

// 2. Syntax check background.js and popup.js
try {
  const bgCode = readFileSync(join(sourceDir, 'background.js'), 'utf8');
  new Function(bgCode);
  console.log('✅ Syntax check passed: background.js');
} catch (err) {
  console.error('❌ Syntax error in background.js:', err.message);
  process.exit(1);
}

try {
  const popCode = readFileSync(join(sourceDir, 'popup.js'), 'utf8');
  new Function(popCode);
  console.log('✅ Syntax check passed: popup.js');
} catch (err) {
  console.error('❌ Syntax error in popup.js:', err.message);
  process.exit(1);
}

// 3. Synchronize to distribution & runtime targets
const targets = [
  { name: 'mcp-server/extension', path: mcpServerExtDir },
  { name: '~/.browser-mcp/extension', path: userExtDir },
  { name: '~/.jeikcode/plugins/browser-mcp/extension', path: pluginExtDir },
];

for (const target of targets) {
  try {
    cpSync(sourceDir, target.path, { recursive: true });
    console.log(`✅ Synchronized to ${target.name}`);
  } catch (err) {
    console.warn(`⚠️ Warning syncing to ${target.name}:`, err.message);
  }
}

// 4. Verify byte-for-byte identity with mcp-server/extension
const srcFiles = readdirSync(sourceDir, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => join(d.parentPath || d.path, d.name).slice(sourceDir.length + 1));

let allMatch = true;
for (const rel of srcFiles) {
  const a = readFileSync(join(sourceDir, rel));
  const b = readFileSync(join(mcpServerExtDir, rel));
  if (!a.equals(b)) {
    console.error(`❌ Mismatch detected in ${rel}`);
    allMatch = false;
  }
}

if (allMatch) {
  console.log(`\n🎉 Build and synchronization complete! (Verified ${srcFiles.length} files)`);
} else {
  console.error('\n❌ Discrepancies detected between source and target files.');
  process.exit(1);
}
