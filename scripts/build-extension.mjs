#!/usr/bin/env node

/**
 * Browser Control - Extension Build & Verification Pipeline
 *
 * Verifies extension syntax and synchronizes source assets
 * to user runtime (~/.browser-control/extension and ~/.browser-mcp/extension).
 */

import { cpSync, existsSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(__dirname); // browser-mcp / browser-control
const sourceDir = join(rootDir, 'extension');
const userExtDir = join(homedir(), '.browser-control', 'extension');
const legacyExtDir = join(homedir(), '.browser-mcp', 'extension');

console.log('=== Validating Browser Control Extension Assets ===\n');

// 1. Verify Source Files
const requiredFiles = ['manifest.json', 'background.js', 'offscreen.js', 'popup.html', 'popup.js'];
for (const file of requiredFiles) {
  const p = join(sourceDir, file);
  if (!existsSync(p)) {
    console.error(`❌ Missing essential source file: ${file}`);
    process.exit(1);
  }
}

// 2. Syntax check background.js, offscreen.js, and popup.js
for (const file of ['background.js', 'offscreen.js', 'popup.js']) {
  try {
    const code = readFileSync(join(sourceDir, file), 'utf8');
    new Function(code);
    console.log(`✅ Syntax check passed: ${file}`);
  } catch (err) {
    console.error(`❌ Syntax error in ${file}:`, err.message);
    process.exit(1);
  }
}

// 3. Synchronize to runtime target if available
try {
  mkdirSync(userExtDir, { recursive: true });
  cpSync(sourceDir, userExtDir, { recursive: true });
  console.log('✅ Synchronized to ~/.browser-control/extension');
} catch (err) {
  console.warn('⚠️ Warning syncing to user directory:', err.message);
}
try {
  mkdirSync(legacyExtDir, { recursive: true });
  cpSync(sourceDir, legacyExtDir, { recursive: true });
  console.log('✅ Synchronized to ~/.browser-mcp/extension');
} catch (err) {
  console.warn('⚠️ Warning syncing to legacy directory:', err.message);
}

console.log('\n🎉 Extension validation complete!');
