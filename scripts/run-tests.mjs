#!/usr/bin/env node

/**
 * Cross-platform test runner for Browser MCP.
 * Resolves test files explicitly so Node 20 on Windows (cmd/PowerShell)
 * never fails on unexpanded POSIX wildcards.
 */

import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDir = resolve(__dirname, '../test');

const files = readdirSync(testDir)
  .filter((f) => f.endsWith('.test.mjs'))
  .map((f) => join(testDir, f));

const r = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(r.status ?? 0);
