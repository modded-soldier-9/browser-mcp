#!/usr/bin/env node
/**
 * Browser MCP - Persistent Standby Bridge Daemon
 *
 * Keeps port 9876 continuously listening in the background so the Brave
 * extension is always connected and ready across all OpenCode chat windows.
 */

import { createWSS, BASE_PORT } from '../lib/bridge.js';

createWSS(BASE_PORT);

// Keep event loop alive indefinitely
const keepAlive = setInterval(() => {}, 2147483647);

process.on('SIGINT', () => { clearInterval(keepAlive); process.exit(0); });
process.on('SIGTERM', () => { clearInterval(keepAlive); process.exit(0); });
