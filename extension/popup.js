// ── Status ──────────────────────────────────────────────────────────────────

function paintStatus(connected, count, sessionCount, ports = []) {
  const dot = document.getElementById('dot');
  const label = document.getElementById('label');
  const sublabel = document.getElementById('sublabel');
  const portBadge = document.getElementById('portBadge');
  const sessionCountBadge = document.getElementById('sessionCountBadge');

  if (sessionCountBadge) {
    sessionCountBadge.textContent = String(sessionCount || 0);
  }

  dot.className = `dot ${connected ? 'on' : 'off'}`;

  if (!connected) {
    label.textContent = 'Disconnected';
    if (sublabel) sublabel.textContent = 'Standby - scanning ports 9876-9895';
    if (portBadge) portBadge.style.display = 'none';
  } else if (sessionCount > 0) {
    label.textContent = `Connected (${sessionCount} session${sessionCount === 1 ? '' : 's'})`;
    if (sublabel) sublabel.textContent = `${count} agent client${count === 1 ? '' : 's'} attached`;
    if (portBadge) {
      portBadge.style.display = 'inline-block';
      portBadge.textContent = ports && ports.length ? `:${ports[0]}` : 'Active';
    }
  } else {
    label.textContent = `Connected - ready`;
    if (sublabel) sublabel.textContent = `${count} agent${count === 1 ? '' : 's'} listening on bridge`;
    if (portBadge) {
      portBadge.style.display = 'inline-block';
      portBadge.textContent = ports && ports.length ? `:${ports[0]}` : 'Ready';
    }
  }

  // Setup assistance drawer when MCP server is not reachable
  const setupEl = document.getElementById('setup');
  if (setupEl) {
    setupEl.classList.toggle('show', !connected);
  }

  // Help prompts when connected and waiting for first tool action
  const tryEl = document.getElementById('try');
  if (tryEl) {
    tryEl.classList.toggle('show', connected && sessionCount === 0);
  }
}

function refreshStatus() {
  chrome.storage.local.get({ mcpConnected: false, mcpCount: 0, mcpPorts: [], sessions: {} }, (result) => {
    paintStatus(
      result.mcpConnected === true,
      result.mcpCount || 0,
      Object.keys(result.sessions || {}).length,
      result.mcpPorts || []
    );
  });

  // Query offscreen bridge for live real-time status
  chrome.runtime.sendMessage({ type: 'bmcp_get_status' }, (response) => {
    if (chrome.runtime.lastError || !response || !response.ok) return;
    chrome.storage.local.get({ sessions: {} }, ({ sessions = {} }) => {
      paintStatus(
        response.connected === true,
        response.count || 0,
        Object.keys(sessions).length,
        response.ports || []
      );
    });
  });
}

refreshStatus();

// ── Sessions with tabs ─────────────────────────────────────────────────────

function renderSessions() {
  chrome.storage.local.get({ sessions: {} }, ({ sessions }) => {
    const container = document.getElementById('sessions');
    const entries = Object.entries(sessions || {});

    const sessionCountBadge = document.getElementById('sessionCountBadge');
    if (sessionCountBadge) {
      sessionCountBadge.textContent = String(entries.length);
    }

    if (!entries.length) {
      container.innerHTML = '<div class="empty">No browser tabs claimed yet</div>';
      return;
    }

    // Fetch tab info for each active session
    const promises = entries.map(async ([port, session]) => {
      const tabInfos = [];
      for (const tabId of session.tabIds || []) {
        try {
          const tab = await chrome.tabs.get(tabId);
          const title = tab.title || '';
          const url = tab.url || '';
          const display = title ? (title.length > 32 ? title.slice(0, 32) + '…' : title)
                                : (url.length > 36 ? url.slice(0, 36) + '…' : url);
          tabInfos.push({ id: tabId, display, url });
        } catch {}
      }
      return { port, session, tabInfos };
    });

    Promise.all(promises).then(results => {
      container.innerHTML = results.map(({ port, session, tabInfos }) => {
        const color = session.color || 'blue';
        const tabHtml = tabInfos.length
          ? tabInfos.map(t => `<div title="${t.url || ''}">${t.display}</div>`).join('')
          : '<div>No tabs assigned</div>';
        return `
          <div class="session-card color-${color}">
            <div class="session-header">
              <span>${session.label}</span>
              <span style="font-weight:normal;font-size:10px;color:#64748b;font-family:ui-monospace,monospace">port ${port}</span>
            </div>
            <div class="session-tabs">${tabHtml}</div>
          </div>`;
      }).join('');
    });
  });
}

renderSessions();

// ── Action Log ──────────────────────────────────────────────────────────────

function renderLog() {
  chrome.storage.local.get({ actionLog: [] }, ({ actionLog }) => {
    const container = document.getElementById('log');
    const entries = Array.isArray(actionLog) ? actionLog : [];

    const logCountBadge = document.getElementById('logCountBadge');
    if (logCountBadge) {
      logCountBadge.textContent = String(entries.length);
    }

    if (!entries.length) {
      container.innerHTML = '<div class="empty">No actions logged yet</div>';
      return;
    }

    container.innerHTML = entries.slice(0, 40).map(entry => {
      const time = new Date(entry.time).toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      const cat = entry.category || 'safe';
      const cls = cat === 'sensitive' ? 'log-sensitive' : 'log-safe';
      return `
        <div class="log-entry">
          <span class="log-time">${time}</span>
          <span class="log-method ${cls}">${entry.method}</span>
          <span class="log-session">${entry.session || ''}</span>
        </div>`;
    }).join('');
  });
}

renderLog();

// ── Real-time Updates ───────────────────────────────────────────────────────

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes.mcpConnected || changes.mcpCount || changes.mcpPorts || changes.sessions) {
    refreshStatus();
    renderSessions();
  }
  if (changes.actionLog) {
    renderLog();
  }
});

// ── Controls & Actions ──────────────────────────────────────────────────────

document.getElementById('reconnect').addEventListener('click', () => {
  const dot = document.getElementById('dot');
  const label = document.getElementById('label');
  const sublabel = document.getElementById('sublabel');

  if (dot) dot.className = 'dot scanning';
  if (label) label.textContent = 'Reconnecting…';
  if (sublabel) sublabel.textContent = 'Probing ports 9876-9895';

  chrome.runtime.sendMessage({ type: 'reconnect' });
  chrome.runtime.sendMessage({ type: 'bmcp_scan_now' }).catch(() => {});

  [300, 800, 1500].forEach((delay) => {
    setTimeout(() => {
      refreshStatus();
      renderSessions();
      renderLog();
    }, delay);
  });
});

document.getElementById('copyCmd').addEventListener('click', (e) => {
  const cmd = document.getElementById('setupCmd').textContent.trim();
  navigator.clipboard.writeText(cmd);
  const orig = e.target.textContent;
  e.target.textContent = 'Copied!';
  setTimeout(() => { e.target.textContent = orig; }, 1500);
});

document.getElementById('clearLog').addEventListener('click', () => {
  chrome.storage.local.set({ actionLog: [] }, renderLog);
});
