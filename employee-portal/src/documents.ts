// FR-06 Documents — pure helpers (validation + visibility). No Worker/D1.
export const DOC_CATEGORIES = ["payslip", "letter", "policy", "other"] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number];
export const DOC_STATUSES = ["draft", "published"] as const;

export function isValidDocCategory(c: string): c is DocCategory {
  return (DOC_CATEGORIES as readonly string[]).includes(c);
}
export function isValidDocStatus(s: string): boolean {
  return (DOC_STATUSES as readonly string[]).includes(s);
}

export interface DocLite { employeeId: string; status: string; }

/** Who may view a document. HR/managers (document.manage) see everything, including
 *  drafts. An employee sees only their OWN document, and only once PUBLISHED — a
 *  draft payslip is never visible to the employee (FR-06). */
export function canViewDocument(actorEmployeeId: string | null, doc: DocLite, isManager: boolean): boolean {
  if (isManager) return true;
  return !!actorEmployeeId && actorEmployeeId === doc.employeeId && doc.status === "published";
}
