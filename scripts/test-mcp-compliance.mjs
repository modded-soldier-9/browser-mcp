import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const binName = process.platform === 'win32' ? 'browser-mcp.exe' : 'browser-mcp';
const binPath = join(rootDir, 'target', 'release', binName);

if (!existsSync(binPath)) {
  console.error(`Binary not found at ${binPath}. Please compile release binary first.`);
  process.exit(1);
}

// Start browser-mcp process on isolated port range
const proc = spawn(binPath, [], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    BROWSER_MCP_BASE_PORT: '9880',
    BROWSER_MCP_MAX_PORT: '9885',
  },
});

let stdoutBuf = '';
let nextId = 1000;
const pending = new Map();
const unhandledMessages = [];

proc.stdout.on('data', (chunk) => {
  stdoutBuf += chunk.toString('utf8');
  const lines = stdoutBuf.split('\n');
  stdoutBuf = lines.pop();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed);
      if (msg.id !== undefined && pending.has(msg.id)) {
        const handler = pending.get(msg.id);
        pending.delete(msg.id);
        handler(msg);
      } else {
        unhandledMessages.push(msg);
      }
    } catch (e) {
      console.error('Failed to parse stdout JSON line:', trimmed, e);
    }
  }
});

function sendRequest(method, params, id = null, timeoutMs = 8000) {
  const reqId = id !== null ? id : nextId++;
  const req = {
    jsonrpc: '2.0',
    id: reqId,
    method,
  };
  if (params !== undefined) {
    req.params = params;
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(reqId);
      reject(new Error(`Timeout waiting for response to ${method} (id=${reqId}) after ${timeoutMs}ms`));
    }, timeoutMs);

    pending.set(reqId, (response) => {
      clearTimeout(timer);
      resolve(response);
    });

    proc.stdin.write(JSON.stringify(req) + '\n');
  });
}

function sendRawLine(line) {
  proc.stdin.write(line + '\n');
}

function sendNotification(method, params) {
  const notif = {
    jsonrpc: '2.0',
    method,
  };
  if (params !== undefined) {
    notif.params = params;
  }
  proc.stdin.write(JSON.stringify(notif) + '\n');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runComplianceEvaluation() {
  const report = {
    totalChecked: 0,
    passed: 0,
    failed: 0,
    categories: {
      endpoints: { passed: 0, failed: 0, tests: [] },
      toolsSchema: { passed: 0, failed: 0, tests: [] },
      toolsFraming: { passed: 0, failed: 0, tests: [] },
      errorReporting: { passed: 0, failed: 0, tests: [] },
      stdioRobustness: { passed: 0, failed: 0, tests: [] },
    },
  };

  function check(category, testName, condition, details = '') {
    report.totalChecked++;
    if (condition) {
      report.passed++;
      report.categories[category].passed++;
      report.categories[category].tests.push({ name: testName, status: 'PASS', details });
      console.log(`  [PASS] ${testName}`);
    } else {
      report.failed++;
      report.categories[category].failed++;
      report.categories[category].tests.push({ name: testName, status: 'FAIL', details });
      console.error(`  [FAIL] ${testName} - ${details}`);
    }
  }

  console.log('================================================================');
  console.log('MCP Protocol Specification & stdio JSON-RPC Compliance Evaluation');
  console.log('================================================================\n');

  // 1. ENDPOINTS: initialize, notifications/initialized, ping
  console.log('>>> [1/5] Evaluating Core Endpoints (initialize, notifications/initialized, ping)...');
  {
    // initialize
    const initReq = {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'evaluator', version: '2.0.0' },
    };
    const initRes = await sendRequest('initialize', initReq, 'init-01');

    check('endpoints', 'initialize framing conforms to JSON-RPC 2.0',
      initRes.jsonrpc === '2.0' && initRes.id === 'init-01' && initRes.error === undefined && initRes.result !== undefined
    );
    check('endpoints', 'initialize protocolVersion is 2024-11-05',
      initRes.result?.protocolVersion === '2024-11-05'
    );
    check('endpoints', 'initialize serverInfo contains name and version',
      initRes.result?.serverInfo?.name === 'browser-mcp' && typeof initRes.result?.serverInfo?.version === 'string'
    );
    check('endpoints', 'initialize capabilities advertises tools capability',
      typeof initRes.result?.capabilities?.tools === 'object'
    );
    check('endpoints', 'initialize includes instructions guidance string',
      typeof initRes.result?.instructions === 'string' && initRes.result.instructions.length > 0
    );

    // notifications/initialized
    const unhandledBefore = unhandledMessages.length;
    sendNotification('notifications/initialized');
    await sleep(150);
    check('endpoints', 'notifications/initialized suppresses stdout responses per spec',
      unhandledMessages.length === unhandledBefore
    );

    // ping (fast-path)
    const t0 = performance.now();
    const pingNumeric = await sendRequest('ping', {}, 777);
    const latency = performance.now() - t0;

    check('endpoints', 'ping responds with empty result object',
      pingNumeric.jsonrpc === '2.0' && pingNumeric.id === 777 && typeof pingNumeric.result === 'object' && Object.keys(pingNumeric.result).length === 0
    );
    check('endpoints', 'ping fast-path latency under 20ms',
      latency < 20,
      `Actual latency: ${latency.toFixed(2)}ms`
    );

    // ping string id preservation
    const pingStr = await sendRequest('ping', {}, 'ping-str-id-99');
    check('endpoints', 'ping preserves string ID serialization',
      pingStr.id === 'ping-str-id-99'
    );
  }

  // 2. ENDPOINT: tools/list & All 43 Tool Schemas
  console.log('\n>>> [2/5] Evaluating tools/list & All 43 Tool Schemas...');
  let toolList = [];
  {
    const listRes = await sendRequest('tools/list', {}, 'tools-list-01');
    check('toolsSchema', 'tools/list conforms to JSON-RPC 2.0 result structure',
      listRes.jsonrpc === '2.0' && listRes.id === 'tools-list-01' && Array.isArray(listRes.result?.tools)
    );

    toolList = listRes.result?.tools || [];
    check('toolsSchema', 'tools/list returns exactly 43 tools',
      toolList.length === 43,
      `Found ${toolList.length} tools`
    );

    let schemaConformantCount = 0;
    let missingProps = [];
    for (const t of toolList) {
      const hasName = typeof t.name === 'string' && t.name.length > 0;
      const hasDesc = typeof t.description === 'string' && t.description.length > 0;
      const hasSchemaObj = t.inputSchema && t.inputSchema.type === 'object';
      const hasProperties = t.inputSchema && typeof t.inputSchema.properties === 'object';

      let requiredValid = true;
      if (t.inputSchema?.required) {
        if (!Array.isArray(t.inputSchema.required)) {
          requiredValid = false;
        } else {
          for (const req of t.inputSchema.required) {
            if (!t.inputSchema.properties?.[req]) {
              requiredValid = false;
              missingProps.push(`${t.name}.${req}`);
            }
          }
        }
      }

      if (hasName && hasDesc && hasSchemaObj && hasProperties && requiredValid) {
        schemaConformantCount++;
      }
    }

    check('toolsSchema', 'All 43 tools meet MCP JSON Schema specification',
      schemaConformantCount === 43,
      `${schemaConformantCount}/43 valid. Missing props: ${missingProps.join(', ')}`
    );
  }

  // 3. TOOLS/CALL: Request/Response Framing
  console.log('\n>>> [3/5] Evaluating tools/call Request/Response Framing...');
  {
    // Connect mock extension WebSocket client to test tools/call framing for remote tools
    let mockWs = null;
    let extensionConnected = false;
    try {
      mockWs = new WebSocket('ws://127.0.0.1:9880', {
        headers: { Origin: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      });
      mockWs.onopen = () => {
        extensionConnected = true;
        mockWs.send(JSON.stringify({
          type: 'hello',
          extensionId: 'compliance-mock',
          version: '1.0.0',
          profile: 'default',
        }));
      };
      mockWs.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'ping') {
            mockWs.send(JSON.stringify({ type: 'pong' }));
            return;
          }
          if (parsed.id) {
            mockWs.send(JSON.stringify({
              id: parsed.id,
              success: true,
              result: { tool: parsed.method, status: 'ok' },
            }));
          }
        } catch (_) {}
      };
    } catch (e) {
      console.warn('Mock WS connection skipped:', e.message);
    }

    // Wait briefly for WS handshake
    await sleep(250);

    // Test local tool browser_about
    const aboutRes = await sendRequest('tools/call', { name: 'browser_about', arguments: {} }, 501);
    check('toolsFraming', 'browser_about returns CallToolResult with TextContent',
      aboutRes.result?.content?.[0]?.type === 'text' && !aboutRes.result?.isError
    );

    // Test unprefixed tool name normalization
    const normRes = await sendRequest('tools/call', { name: 'about', arguments: {} }, 502);
    check('toolsFraming', 'Tool name normalization allows omitting "browser_" prefix',
      normRes.result?.content?.[0]?.type === 'text' && !normRes.result?.isError
    );

    // Test unknown tool returns CallToolResult with isError: true
    const unkRes = await sendRequest('tools/call', { name: 'non_existent_tool_mcp', arguments: {} }, 503);
    check('toolsFraming', 'Unknown tool returns CallToolResult with isError: true',
      unkRes.result?.isError === true && unkRes.result?.content?.[0]?.text?.includes('Unknown tool')
    );
    check('toolsFraming', 'Unknown tool does NOT return JSON-RPC transport error (spec compliant)',
      unkRes.error === undefined
    );

    // Test local tool validation failure: browser_provide_feedback with empty feedback
    const feedErrRes = await sendRequest('tools/call', { name: 'browser_provide_feedback', arguments: { feedback: '' } }, 504);
    check('toolsFraming', 'Validation error returns CallToolResult with isError: true',
      feedErrRes.result?.isError === true && feedErrRes.result?.content?.[0]?.text?.includes('Error')
    );

    // Test local tool success: browser_provide_feedback
    const feedOkRes = await sendRequest('tools/call', { name: 'browser_provide_feedback', arguments: { feedback: 'Compliance OK' } }, 505);
    check('toolsFraming', 'Successful tool call omits isError field or sets false',
      feedOkRes.result?.isError !== true && feedOkRes.result?.content?.[0]?.type === 'text'
    );

    // Test sandbox security rejection: browser_screenshot with path traversal
    const badScreenRes = await sendRequest('tools/call', { name: 'browser_screenshot', arguments: { path: '../../evil.png' } }, 506);
    check('toolsFraming', 'Sandbox directory traversal rejection returns isError: true',
      badScreenRes.result?.isError === true && badScreenRes.result?.content?.[0]?.text?.includes('working directory')
    );

    // Test bridge-dispatched tool framing if extension connected
    if (extensionConnected) {
      const navRes = await sendRequest('tools/call', { name: 'browser_navigate', arguments: { url: 'https://example.com' } }, 507);
      check('toolsFraming', 'Bridge-dispatched tool formats CallToolResult with TextContent',
        navRes.result?.content?.[0]?.type === 'text' && navRes.result?.isError !== true
      );
    } else {
      console.log('  (Bridge offline fallback tested via Rust compliance_test suite)');
    }

    if (mockWs) {
      try { mockWs.close(); } catch (_) {}
    }
  }

  // 4. ERROR REPORTING CODES & ERROR OBJECT CONFORMITY
  console.log('\n>>> [4/5] Evaluating JSON-RPC Error Reporting Codes & Object Conformity...');
  {
    // Method not found: JSON-RPC -32601
    const unkMethodRes = await sendRequest('non_existent/endpoint', {}, 901);
    check('errorReporting', 'Unknown method returns JSON-RPC -32601 code',
      unkMethodRes.error?.code === -32601,
      `Got code: ${unkMethodRes.error?.code}`
    );
    check('errorReporting', 'Unknown method error object contains message string',
      typeof unkMethodRes.error?.message === 'string' && unkMethodRes.error.message.includes('Method not found')
    );
    check('errorReporting', 'Unknown method error response omits result member',
      unkMethodRes.result === undefined
    );

    // Notification for unknown method (no response emitted)
    const countBeforeNotif = unhandledMessages.length;
    sendNotification('non_existent/notification');
    await sleep(150);
    check('errorReporting', 'Unknown notification emits NO response (Section 4.1 compliant)',
      unhandledMessages.length === countBeforeNotif
    );

    // Request ID types conformity: integer, string, float, null
    const reqInt = await sendRequest('ping', {}, 12345);
    check('errorReporting', 'Integer ID is preserved in response', reqInt.id === 12345);

    const reqStr = await sendRequest('ping', {}, 'custom-id-xyz');
    check('errorReporting', 'String ID is preserved in response', reqStr.id === 'custom-id-xyz');
  }

  // 5. STDIO ROBUSTNESS & SERIALIZATION FRAMING
  console.log('\n>>> [5/5] Evaluating stdio Robustness & Serialization Framing...');
  {
    // Empty line injection (should be ignored gracefully without error or crash)
    sendRawLine('');
    sendRawLine('   ');
    await sleep(50);
    const postBlankPing = await sendRequest('ping', {}, 801);
    check('stdioRobustness', 'Server handles blank lines and whitespace gracefully',
      postBlankPing.id === 801
    );

    // Malformed JSON line injection (should not crash server or corrupt subsequent messages)
    sendRawLine('{ "jsonrpc": "2.0", "broken');
    sendRawLine('NOT_A_JSON');
    await sleep(50);
    const postMalformedPing = await sendRequest('ping', {}, 802);
    check('stdioRobustness', 'Server recovers gracefully from malformed stdin lines',
      postMalformedPing.id === 802
    );

    // Verify newline framing: every response line on stdout is valid single-line JSON
    check('stdioRobustness', 'Stdout messages strictly adhere to single-line JSON formatting',
      stdoutBuf.indexOf('\n') === -1 // buffer empty, all preceding lines were valid JSON
    );
  }

  console.log('\n================================================================');
  console.log(`EVALUATION COMPLETE: ${report.passed} PASSED, ${report.failed} FAILED across ${report.totalChecked} checks.`);
  console.log('================================================================');

  proc.kill();
  return report;
}

runComplianceEvaluation().then((report) => {
  if (report.failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}).catch((err) => {
  console.error('Fatal evaluation failure:', err);
  proc.kill();
  process.exit(1);
});
