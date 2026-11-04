#!/usr/bin/env node

/**
 * Browser MCP - Icon Generator Pipeline
 * 
 * Rasterizes assets/logo.svg into high-resolution multi-scale PNG icons
 * for the Chrome Extension and Documentation site.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(__dirname);

console.log('=== Generating Browser MCP Multi-Scale Icons ===\n');

const pyScript = join(__dirname, 'generate-icons.py');

if (!existsSync(pyScript)) {
  console.error('❌ Missing scripts/generate-icons.py');
  process.exit(1);
}

const result = spawnSync('python', [pyScript], {
  cwd: rootDir,
  stdio: 'inherit'
});

if (result.status !== 0) {
  console.error('❌ Failed to generate icons via Python renderer');
  process.exit(result.status || 1);
}

console.log('\n🎉 Icons successfully generated for Extension and Docs!');
