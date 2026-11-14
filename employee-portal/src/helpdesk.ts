// FR-09 Helpdesk — pure helpers (categories, SLA, visibility). No Worker/D1.
//
// POSH is special (FR-21): a POSH ticket is visible ONLY to the complainant and the
// Internal Committee — never to ordinary helpdesk agents, and not to super_admin by
// role. That rule lives in canViewTicket and takes the committee flag, which the
// Worker computes from the posh_committee table (not from hasPermission's allow-all).

export const TICKET_CATEGORIES = ["hr", "it", "general", "posh"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export function isValidCategory(c: string): c is TicketCategory {
  return (TICKET_CATEGORIES as readonly string[]).includes(c);
}
export function isValidStatus(s: string): s is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(s);
}

// SLA target hours per category (for display / overdue flagging).
export const SLA_HOURS: Record<TicketCategory, number> = { hr: 24, it: 8, general: 48, posh: 24 };

function parseStamp(s: string): number {
  // D1 datetime('now') is "YYYY-MM-DD HH:MM:SS" in UTC, with no zone marker.
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  return Date.parse(iso.endsWith("Z") || /[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z");
}

export function slaDueISO(createdAt: string, category: TicketCategory): string | null {
  const t = parseStamp(createdAt);
  if (Number.isNaN(t)) return null;
  return new Date(t + SLA_HOURS[category] * 3_600_000).toISOString();
}

export function isOverdue(createdAt: string, category: TicketCategory, status: string, nowISO: string): boolean {
  if (status === "resolved" || status === "closed") return false;
  const due = slaDueISO(createdAt, category);
  return !!due && nowISO > due;
}

export interface TicketLite { employeeId: string; category: string; }
export interface ViewFlags { isAgent: boolean; isCommittee: boolean; }

/** Who may VIEW a ticket: the creator always; a POSH ticket only the committee (never
 *  plain agents or super_admin-by-role); any other ticket, helpdesk agents. */
export function canViewTicket(actorEmployeeId: string | null, t: TicketLite, f: ViewFlags): boolean {
  if (actorEmployeeId && actorEmployeeId === t.employeeId) return true;
  if (t.category === "posh") return f.isCommittee;
  return f.isAgent;
}

/** Who may HANDLE a ticket (change status / assign): committee for POSH, agents
 *  otherwise. (The creator can comment via view rights, but not self-handle.) */
export function canHandleTicket(t: TicketLite, f: ViewFlags): boolean {
  if (t.category === "posh") return f.isCommittee;
  return f.isAgent;
}
