// FR-05 Tasks — pure helpers (validation + due-date state). No Worker/D1.
export const TASK_STATUSES = ["open", "in_progress", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export function isValidTaskStatus(s: string): s is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(s);
}
export function isValidPriority(p: string): p is TaskPriority {
  return (TASK_PRIORITIES as readonly string[]).includes(p);
}

/** A task is "open" (still needs doing) while open or in progress. */
export function isTaskOpen(status: string): boolean {
  return status === "open" || status === "in_progress";
}

/** Overdue only while still open and past its due date. */
export function taskOverdue(dueDate: string | null, status: string, today: string): boolean {
  return isTaskOpen(status) && !!dueDate && dueDate < today;
}
