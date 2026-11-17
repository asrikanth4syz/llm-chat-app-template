// Resignation & exit workflow — pure state machine (no Worker/D1/network). The handler
// resolves DB context (manager exists, clearance done, actor role) into a TCtx and asks this
// module whether a transition is allowed and what the resulting status is. Unit-tested.

export type RState =
  | "pending_manager"        // submitted, awaiting the reporting manager
  | "pending_hr"             // manager-approved (or auto-routed), awaiting HR review
  | "notice_period"          // HR approved; employee serving notice
  | "clearance_pending"      // clearance initiated, tasks seeded, none started
  | "clearance_in_progress"  // at least one clearance task touched, not all done
  | "clearance_completed"    // all required clearance tasks done
  | "fnf_pending"            // full & final settlement being prepared
  | "fnf_completed"          // settlement recorded
  | "relieved"               // exit complete (terminal)
  | "rejected"               // terminal
  | "withdrawn";             // terminal

// A request is "active" (blocks a second request) in every state except the three terminals.
// Rejected or Withdrawn may be resubmitted; Relieved is final.
export const INACTIVE_STATES: RState[] = ["rejected", "withdrawn", "relieved"];
export function isActiveState(s: string): boolean {
  return !INACTIVE_STATES.includes(s as RState);
}

// Ordered main-path stages, for the employee progress tracker. Clearance's three sub-states
// collapse to one tracker step; the side terminals (rejected/withdrawn) are not in the path.
export const STAGE_ORDER: RState[] = [
  "pending_manager", "pending_hr", "notice_period",
  "clearance_pending", "clearance_completed", "fnf_pending", "fnf_completed", "relieved",
];
// Index of a status within the main path (clearance_in_progress maps onto clearance_pending's
// slot). -1 for side terminals.
export function stageIndex(s: string): number {
  if (s === "clearance_in_progress") return STAGE_ORDER.indexOf("clearance_pending");
  return STAGE_ORDER.indexOf(s as RState);
}

export type RAction =
  | "manager_approve" | "manager_reject"
  | "hr_approve" | "hr_reject"
  | "start_clearance" | "clearance_recompute"
  | "fnf_start" | "fnf_complete"
  | "relieve" | "waive"
  | "withdraw" | "withdraw_approve" | "withdraw_reject";

export interface TCtx {
  isHr?: boolean;            // actor holds the HR/admin workflow permission
  isManager?: boolean;       // actor is the reporting manager of this employee (or delegate)
  isOwner?: boolean;         // actor is the resigning employee
  remarks?: string;          // free-text remarks supplied with the action
  decision?: "approve" | "reject";
  allClearanceDone?: boolean;// every required clearance task is Completed
  anyClearanceStarted?: boolean; // at least one clearance task is In Progress/Completed
  exception?: boolean;       // authorised exception recorded (reason/approver/timestamp)
}

export interface TResult { ok: boolean; next?: RState; error?: string; }
const no = (error: string): TResult => ({ ok: false, error });
const go = (next: RState): TResult => ({ ok: true, next });
const hasText = (s?: string): boolean => !!(s && s.trim());

// The single authority for "may this action move this request, and to where?". Pure.
export function validateTransition(cur: RState, action: RAction, ctx: TCtx): TResult {
  switch (action) {
    case "manager_approve":
      if (cur !== "pending_manager") return no("not awaiting manager approval");
      if (!ctx.isManager && !ctx.isHr) return no("only the reporting manager (or HR) may decide");
      if (!hasText(ctx.remarks)) return no("remarks are required");
      return go("pending_hr"); // manager approval never means final acceptance
    case "manager_reject":
      if (cur !== "pending_manager") return no("not awaiting manager approval");
      if (!ctx.isManager && !ctx.isHr) return no("only the reporting manager (or HR) may decide");
      if (!hasText(ctx.remarks)) return no("remarks are required to reject");
      return go("rejected");

    case "hr_approve":
      if (cur !== "pending_hr") return no("not awaiting HR review");
      if (!ctx.isHr) return no("only HR/Admin may review");
      return go("notice_period");
    case "hr_reject":
      if (cur !== "pending_hr") return no("not awaiting HR review");
      if (!ctx.isHr) return no("only HR/Admin may review");
      if (!hasText(ctx.remarks)) return no("remarks are required to reject");
      return go("rejected");

    case "start_clearance":
      if (cur !== "notice_period") return no("clearance starts from the notice period");
      if (!ctx.isHr) return no("only HR/Admin may initiate clearance");
      return go("clearance_pending");
    case "clearance_recompute": // derive overall clearance status from the tasks
      if (cur !== "clearance_pending" && cur !== "clearance_in_progress" && cur !== "clearance_completed") return no("not in clearance");
      if (ctx.allClearanceDone) return go("clearance_completed");
      if (ctx.anyClearanceStarted) return go("clearance_in_progress");
      return go("clearance_pending");

    case "fnf_start":
      if (cur !== "clearance_completed") return no("complete clearance before full & final");
      if (!ctx.isHr) return no("only HR/Admin may start full & final");
      return go("fnf_pending");
    case "fnf_complete":
      if (cur !== "fnf_pending") return no("full & final is not pending");
      if (!ctx.isHr) return no("only HR/Admin may record the settlement");
      return go("fnf_completed");

    case "relieve":
      if (!ctx.isHr) return no("only HR/Admin may mark relieved");
      if (cur === "fnf_completed") return go("relieved");
      // authorised exception may relieve from an earlier state with a recorded reason
      if (ctx.exception) {
        if (!hasText(ctx.remarks)) return no("exception reason is required");
        if (!isActiveState(cur)) return no("request is already closed");
        return go("relieved");
      }
      return no("clearance and full & final must be complete (or record an authorised exception)");

    case "waive":
      if (cur !== "notice_period") return no("waiver applies during the notice period");
      if (!ctx.isHr) return no("only HR/Admin may approve a waiver");
      if (!hasText(ctx.remarks)) return no("a waiver reason is required");
      return go("notice_period"); // stays in notice with a new (earlier) LWD + waived flag

    case "withdraw":
      if (!ctx.isOwner) return no("only the employee may withdraw");
      if (cur !== "pending_manager" && cur !== "pending_hr") return no("after HR approval, withdrawal needs HR approval");
      if (!hasText(ctx.remarks)) return no("remarks are required");
      return go("withdrawn"); // direct withdrawal only before HR approval
    case "withdraw_approve":
      if (!ctx.isHr) return no("only HR/Admin may approve a withdrawal");
      if (!isActiveState(cur)) return no("request is already closed");
      return go("withdrawn");
    case "withdraw_reject":
      if (!ctx.isHr) return no("only HR/Admin may decide a withdrawal");
      return go(cur); // stays where it was; handler clears the withdraw-requested flag
  }
  return no("unknown action");
}
