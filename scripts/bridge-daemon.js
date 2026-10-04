#!/usr/bin/env node
/**
 * Browser MCP - Persistent Standby Bridge Daemon
 *
 * Keeps port 9876 continuously listening in the background so the Brave
 * extension is always connected and ready across all OpenCode chat windows.
 */

import { createWSS, BASE_PORT } from '../mcp-server/lib/bridge.js';

process.title = 'browser-mcp-daemon';
createWSS(BASE_PORT);

// Keep process alive indefinitely
setInterval(() => {}, 60000);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
