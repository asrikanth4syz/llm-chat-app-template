// ============================================================================
// Quotations (milestone 006) — PURE approval / separation-of-duties decision core.
//
// No DB / no env: given the required legs, the author set, the entitled users
// and the configured fallback, decide who approves each leg (or auto-satisfy /
// 409), and whether an act-time approve is allowed. Wired by the submit/approve/
// reject handlers in src/index.ts. Unit-tested in test/quote_approval.test.ts.
//
// Authority: plans/active_milestones/006-quotations/{data-model,api-contracts}.md
// (SoD + author-authority rule, r3/r4 product decisions):
//  - author set = creator ∪ EVERY version author (disqualifies from approving);
//  - Manager leg AUTO_SATISFIED iff the CURRENT-version author holds commercial_manager;
//  - Finance leg NEVER auto-satisfied (ITC / ₹5L control);
//  - else a non-author role approver; else the fallback (entitled approver, ∉ author
//    set, one leg per quote, finance-leg fallback must hold finance); else 409.
// ============================================================================
import { APPROVER_ROLES, type QuoteRole, type ApprovalLeg } from "./quote_access";

export class QuoteApprovalError extends Error {
  code: string; status: number; leg?: ApprovalLeg;
  constructor(code: string, message: string, status: number, leg?: ApprovalLeg) {
    super(message); this.name = "QuoteApprovalError"; this.code = code; this.status = status; this.leg = leg;
  }
}

/** Which approval legs a submitted quote needs. Manager always; Finance when a
 *  line is ITC-non-claimable OR the (post-round-off, GST-inclusive) grand total
 *  meets the threshold. */
export function requiredLegs(itcClaimableAll: boolean, grandTotalPaise: number, thresholdPaise: number): ApprovalLeg[] {
  const legs: ApprovalLeg[] = ["manager"];
  if (!itcClaimableAll || grandTotalPaise >= thresholdPaise) legs.push("finance");
  return legs;
}

export function legRole(leg: ApprovalLeg): QuoteRole {
  return leg === "manager" ? "commercial_manager" : "finance";
}

export type LegStatus = "AUTO_SATISFIED" | "PENDING";
export interface LegPlan {
  leg: ApprovalLeg;
  status: LegStatus;
  assigned_to: string | null;      // the user who must approve (null for AUTO_SATISFIED's author is set)
  assigned_as_fallback: boolean;
}
export interface SubmitPlan {
  legs: LegPlan[];
  finalStatus: "APPROVED" | "PENDING_APPROVAL";
}

export interface PlanInput {
  requiredLegs: ApprovalLeg[];
  authorSet: ReadonlySet<string>;
  currentVersionAuthor: string;
  users: Record<string, QuoteRole>;   // entitled users → quote-role
  fallbackId: string | null;
}

/** Can `fallbackId` stand in for `leg`? Entitled approver role; finance leg needs finance. */
function fallbackEligibleFor(leg: ApprovalLeg, users: Record<string, QuoteRole>, fallbackId: string, authorSet: ReadonlySet<string>): boolean {
  const role = users[fallbackId];
  if (!role || !APPROVER_ROLES.includes(role)) return false;
  if (authorSet.has(fallbackId)) return false;
  if (leg === "finance") return role === "finance";
  return true; // manager leg: either approver role may cover
}

/** Plan each required leg at submit time (throws 409 E_NO_ELIGIBLE_APPROVER naming the leg). */
export function planSubmit(input: PlanInput): SubmitPlan {
  const usersWithRole = (role: QuoteRole) =>
    Object.keys(input.users).filter((u) => input.users[u] === role).sort();
  const legs: LegPlan[] = [];
  // No single user may be assigned to more than one leg of the same quote
  // (covers both the role path and the fallback path).
  const assigned = new Set<string>();

  for (const leg of input.requiredLegs) {
    // Manager leg auto-satisfies when the CURRENT-version author is a manager.
    if (leg === "manager" && input.users[input.currentVersionAuthor] === "commercial_manager") {
      legs.push({ leg, status: "AUTO_SATISFIED", assigned_to: input.currentVersionAuthor, assigned_as_fallback: false });
      assigned.add(input.currentVersionAuthor);
      continue;
    }
    // A non-author holder of the leg's role who isn't already taking the other leg.
    const role = legRole(leg);
    const cand = usersWithRole(role).filter((u) => !input.authorSet.has(u) && !assigned.has(u));
    if (cand.length) {
      legs.push({ leg, status: "PENDING", assigned_to: cand[0], assigned_as_fallback: false });
      assigned.add(cand[0]);
      continue;
    }
    // The configured fallback — eligible only if not already taking the other leg.
    if (input.fallbackId && !assigned.has(input.fallbackId) && fallbackEligibleFor(leg, input.users, input.fallbackId, input.authorSet)) {
      legs.push({ leg, status: "PENDING", assigned_to: input.fallbackId, assigned_as_fallback: true });
      assigned.add(input.fallbackId);
      continue;
    }
    throw new QuoteApprovalError("E_NO_ELIGIBLE_APPROVER", `no eligible approver for the ${leg} leg`, 409, leg);
  }

  const finalStatus = legs.every((l) => l.status === "AUTO_SATISFIED") ? "APPROVED" : "PENDING_APPROVAL";
  return { legs, finalStatus };
}

export interface ActInput {
  actorId: string;
  actorRole: QuoteRole;
  leg: ApprovalLeg;
  authorSet: ReadonlySet<string>;
  fallbackId: string | null;
  /** userId who already acted on the OTHER leg of this quote (null if none). */
  otherLegActor: string | null;
}

/** May `actorId` act (approve/reject) on `leg`? Throws QuoteApprovalError (403) otherwise. */
export function assertCanActOnLeg(input: ActInput): void {
  if (input.authorSet.has(input.actorId)) {
    throw new QuoteApprovalError("E_SOD", "an author of this quote cannot approve it", 403, input.leg);
  }
  if (input.otherLegActor && input.otherLegActor === input.actorId) {
    throw new QuoteApprovalError("E_SOD_ONE_LEG", "you already acted on the other leg of this quote", 403, input.leg);
  }
  const roleMatches = input.actorRole === legRole(input.leg);
  const isFallback = input.fallbackId === input.actorId &&
    fallbackEligibleFor(input.leg, { [input.actorId]: input.actorRole }, input.actorId, input.authorSet);
  if (!roleMatches && !isFallback) {
    throw new QuoteApprovalError("E_WRONG_LEG", `your quote-role cannot act on the ${input.leg} leg`, 403, input.leg);
  }
}

export type LegRowStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUPERSEDED" | "AUTO_SATISFIED";
/** Is the quote fully approved? All required (non-superseded) legs APPROVED or AUTO_SATISFIED. */
export function isComplete(legs: { status: LegRowStatus }[]): boolean {
  const live = legs.filter((l) => l.status !== "SUPERSEDED");
  return live.length > 0 && live.every((l) => l.status === "APPROVED" || l.status === "AUTO_SATISFIED");
}
