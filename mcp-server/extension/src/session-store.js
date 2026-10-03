/**
 * Browser MCP - Session Store & Tab Isolation
 *
 * Manages tab isolation, tab groups, color assignments, and session lifecycles
 * across concurrent AI agent clients.
 */

export const MAX_TABS_PER_SESSION = 20;

export const SESSION_COLORS = [
  'blue',
  'green',
  'yellow',
  'red',
  'pink',
  'purple',
  'cyan',
  'orange',
];

export const sessions = new Map(); // port -> session state
export const lastSessionSlotByPid = new Map(); // pid -> last assigned session slot

export function getSession(port, pid = null) {
  if (sessions.has(port)) {
    const s = sessions.get(port);
    if (pid !== null && s.pid === null) s.pid = pid;
    return s;
  }

  // Find lowest available slot number
  const usedSlots = new Set();
  for (const s of sessions.values()) {
    if (s.slot) usedSlots.add(s.slot);
  }

  let slot = 1;
  while (usedSlots.has(slot)) slot++;

  const color = SESSION_COLORS[(slot - 1) % SESSION_COLORS.length];
  const session = {
    port,
    pid,
    slot,
    label: `Claude ${slot}`,
    color,
    groupId: null,
    tabIds: new Set(),
    activeTabId: null,
  };

  sessions.set(port, session);
  if (pid) lastSessionSlotByPid.set(pid, slot);
  return session;
}

export function releaseSession(port) {
  if (!sessions.has(port)) return;
  const session = sessions.get(port);
  sessions.delete(port);
  return session;
}
