// R0 access-control proof. Run: npm test  (node --test, strips TS types).
// Proves the headline R0 rule — each login sees only its own details, a manager
// its team, and super_admin everything — plus sensitive-field redaction and
// default deny.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type Actor,
  type EmployeeRecord,
  canReadEmployee,
  canReadSensitive,
  visibleEmployees,
  redactEmployee,
  maskEmployee,
  maskValue,
  canApproveLeaveFor,
  canApproveAttendanceFor,
  toDirectoryEntry,
  hasPermission,
  requiresMfa,
  permissionMatrix,
  isSessionCurrent,
} from "../src/policy.ts";

// --- fixtures: Asha (employee), Bala (employee), Meera (Asha+Bala's manager), admin ---
const asha: EmployeeRecord = { id: "e_asha", userId: "u_asha", managerId: "e_meera", segment: "office", name: "Asha", workEmail: "asha@4syz.com", designation: "Analyst", location: "HSR", pan: "ABCDE1234F", bankAccount: "1111", aadhaarLast4: "4321", ctc: 950000 };
const bala: EmployeeRecord = { id: "e_bala", userId: "u_bala", managerId: "e_meera", segment: "client_site", name: "Bala", workEmail: "bala@4syz.com", designation: "Technician", location: "Client A", pan: "ZYXWV9876K", bankAccount: "2222", aadhaarLast4: "8765", ctc: 600000 };
const meera: EmployeeRecord = { id: "e_meera", userId: "u_meera", managerId: null, segment: "office", name: "Meera", workEmail: "meera@4syz.com", designation: "Manager", location: "HSR", pan: "LMNOP5555Q", bankAccount: "3333", aadhaarLast4: "5555", ctc: 1800000 };
const everyone = [asha, bala, meera];

const actorAsha: Actor = { userId: "u_asha", employeeId: "e_asha", role: "employee" };
const actorBala: Actor = { userId: "u_bala", employeeId: "e_bala", role: "employee" };
const actorMeera: Actor = { userId: "u_meera", employeeId: "e_meera", role: "manager" };
const actorSuper: Actor = { userId: "u_root", employeeId: null, role: "super_admin" };
const actorHr: Actor = { userId: "u_hr", employeeId: "e_hr", role: "hr_admin" };

test("an employee sees strictly their own record", () => {
  assert.equal(canReadEmployee(actorAsha, asha), true);
  assert.equal(canReadEmployee(actorAsha, bala), false); // cannot read a peer (IDOR)
  assert.equal(canReadEmployee(actorAsha, meera), false); // cannot read their manager
  assert.deepEqual(visibleEmployees(actorAsha, everyone).map((e) => e.id), ["e_asha"]);
});

test("one employee cannot reach another's record (IDOR denied both ways)", () => {
  assert.equal(canReadEmployee(actorBala, asha), false);
  assert.equal(canReadEmployee(actorAsha, bala), false);
});

test("super_admin sees every record and every sensitive field", () => {
  for (const e of everyone) {
    assert.equal(canReadEmployee(actorSuper, e), true);
    assert.equal(canReadSensitive(actorSuper, e), true);
  }
  assert.deepEqual(visibleEmployees(actorSuper, everyone).map((e) => e.id).sort(), ["e_asha", "e_bala", "e_meera"]);
  // NFR-03: sensitive PII is masked by default, even for super_admin...
  const view = redactEmployee(actorSuper, asha) as EmployeeRecord;
  assert.equal(view.pan, "••••••234F");
  assert.equal(view.ctc, 950000); // ctc is sensitive but not masked (a number)
  // ...and returned in full only when explicitly revealed (reveal-on-click).
  const revealed = redactEmployee(actorSuper, asha, { reveal: ["pan"] }) as EmployeeRecord;
  assert.equal(revealed.pan, "ABCDE1234F");
});

test("a manager sees the team but not the team's sensitive fields", () => {
  assert.equal(canReadEmployee(actorMeera, asha), true); // direct report
  assert.equal(canReadEmployee(actorMeera, bala), true); // direct report
  assert.equal(visibleEmployees(actorMeera, everyone).length, 3); // self + 2 reports
  // Can read the team, but CTC/PAN/bank stay hidden (manager lacks sensitive.read_all).
  const reportView = redactEmployee(actorMeera, asha) as Record<string, unknown>;
  assert.equal("pan" in reportView, false);
  assert.equal("ctc" in reportView, false);
  assert.equal("bankAccount" in reportView, false);
  // Manager still sees their OWN sensitive fields — masked by default (NFR-03).
  const selfView = redactEmployee(actorMeera, meera) as EmployeeRecord;
  assert.equal(selfView.pan, "••••••555Q");
  assert.equal((redactEmployee(actorMeera, meera, { reveal: ["pan"] }) as EmployeeRecord).pan, "LMNOP5555Q");
});

test("own sensitive fields are masked by default, revealed on request; redaction never mutates (NFR-03)", () => {
  const selfView = redactEmployee(actorAsha, asha) as EmployeeRecord;
  assert.equal(selfView.pan, "••••••234F"); // own PAN masked by default too
  const selfReveal = redactEmployee(actorAsha, asha, { reveal: ["pan"] }) as EmployeeRecord;
  assert.equal(selfReveal.pan, "ABCDE1234F"); // owner can reveal their own
  const peerView = redactEmployee(actorAsha, bala) as Record<string, unknown> | null;
  // (not reachable in a handler — canRead denies first — but redaction is still safe)
  assert.equal("pan" in (peerView as object), false);
  assert.equal(asha.pan, "ABCDE1234F"); // original untouched
});

test("masking keeps only the last 4, fully masks short values, and never mutates (NFR-03)", () => {
  assert.equal(maskValue("ABCDE1234F"), "••••••234F"); // 10 chars → last 4 kept
  assert.equal(maskValue("1111"), "••••"); // <= 4 → fully masked, nothing leaks
  assert.equal(maskValue("123456789012"), "••••••••9012"); // long bank account
  const masked = maskEmployee(asha);
  assert.equal(masked.pan, "••••••234F");
  assert.equal(masked.bankAccount, "••••");
  assert.equal(masked.aadhaarLast4, "••••");
  assert.equal(masked.ctc, 950000); // ctc not masked
  assert.equal(asha.pan, "ABCDE1234F"); // input untouched
});

test("HR/Finance read all records including sensitive, by function", () => {
  assert.equal(canReadEmployee(actorHr, bala), true);
  assert.equal(canReadSensitive(actorHr, bala), true);
});

test("default deny: no permission is granted that a role was not given", () => {
  assert.equal(hasPermission("employee", "employee.read_all"), false);
  assert.equal(hasPermission("manager", "employee.sensitive.read_all"), false);
  assert.equal(hasPermission("auditor", "employee.sensitive.read_all"), false);
  assert.equal(hasPermission("super_admin", "employee.sensitive.read_all"), true);
});

test("2FA is mandatory for EVERY role — employee and manager included (DEC-02 extended)", () => {
  for (const r of ["employee", "manager", "hr_admin", "finance", "it_admin", "auditor", "super_admin"] as const) {
    assert.equal(requiresMfa(r), true);
  }
});

test("permission matrix lists every role with its permissions and MFA flag", () => {
  const m = permissionMatrix();
  assert.equal(m.length, 7);
  const su = m.find((x) => x.role === "super_admin");
  assert.deepEqual(su?.permissions, ["*"]);
  assert.equal(su?.mfa, true);
  const emp = m.find((x) => x.role === "employee");
  assert.equal(emp?.permissions.includes("employee.read_all"), false);
  assert.equal(emp?.mfa, true); // 2FA now required for all roles, employee included
  assert.equal(m.find((x) => x.role === "it_admin")?.permissions.includes("user.manage"), true);
});

test("session is valid only while token version matches (revocation)", () => {
  assert.equal(isSessionCurrent(3, 3), true);
  assert.equal(isSessionCurrent(2, 3), false); // user's version bumped → old token dead
  assert.equal(isSessionCurrent(undefined, 0), false); // legacy token without a version
  assert.equal(isSessionCurrent("3", 3), false); // wrong type never passes
});

test("leave approval: manager approves direct reports only, HR anyone, never self (FR-03/FR-04)", () => {
  assert.equal(canApproveLeaveFor(actorMeera, asha), true);  // direct report
  assert.equal(canApproveLeaveFor(actorMeera, bala), true);  // direct report
  assert.equal(canApproveLeaveFor(actorMeera, meera), false); // self-approval blocked
  assert.equal(canApproveLeaveFor(actorAsha, bala), false);  // a plain employee approves no one
  assert.equal(canApproveLeaveFor(actorHr, asha), true);     // HR covers anyone (their function)
  assert.equal(canApproveLeaveFor(actorSuper, meera), true); // super_admin covers anyone
});

test("attendance correction approval mirrors leave scoping (team/all, never self) (FR-02)", () => {
  assert.equal(canApproveAttendanceFor(actorMeera, asha), true);  // direct report
  assert.equal(canApproveAttendanceFor(actorMeera, meera), false); // self-approval blocked
  assert.equal(canApproveAttendanceFor(actorAsha, bala), false);  // plain employee approves no one
  assert.equal(canApproveAttendanceFor(actorHr, bala), true);     // HR covers anyone
  assert.equal(canApproveAttendanceFor(actorSuper, asha), true);  // super_admin covers anyone
});

test("directory entry exposes only public fields — no salary/bank/identity (FR-08)", () => {
  const entry = toDirectoryEntry({ id: "e_asha", name: "Asha", designation: "Analyst", location: "HSR", segment: "office", workEmail: "asha@4syz.com", managerName: "Meera" });
  assert.deepEqual(Object.keys(entry).sort(), ["designation", "id", "location", "managerName", "name", "photo", "segment", "workEmail"]);
  assert.equal(entry.photo, null);
  for (const k of ["pan", "bankAccount", "aadhaarLast4", "ctc", "phone", "personalEmail", "address"]) {
    assert.equal(k in entry, false);
  }
});
