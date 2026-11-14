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
  const view = redactEmployee(actorSuper, asha) as EmployeeRecord;
  assert.equal(view.pan, "ABCDE1234F");
  assert.equal(view.ctc, 950000);
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
  // Manager still sees their OWN sensitive fields.
  const selfView = redactEmployee(actorMeera, meera) as EmployeeRecord;
  assert.equal(selfView.pan, "LMNOP5555Q");
});

test("own sensitive fields are always visible to the owner; redaction never mutates input", () => {
  const selfView = redactEmployee(actorAsha, asha) as EmployeeRecord;
  assert.equal(selfView.pan, "ABCDE1234F");
  const peerView = redactEmployee(actorAsha, bala) as Record<string, unknown> | null;
  // (not reachable in a handler — canRead denies first — but redaction is still safe)
  assert.equal("pan" in (peerView as object), false);
  assert.equal(asha.pan, "ABCDE1234F"); // original untouched
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

test("MFA is required for privileged roles, not for employee/manager (DEC-02)", () => {
  for (const r of ["hr_admin", "finance", "it_admin", "auditor", "super_admin"] as const) {
    assert.equal(requiresMfa(r), true);
  }
  assert.equal(requiresMfa("employee"), false);
  assert.equal(requiresMfa("manager"), false);
});

test("permission matrix lists every role with its permissions and MFA flag", () => {
  const m = permissionMatrix();
  assert.equal(m.length, 7);
  const su = m.find((x) => x.role === "super_admin");
  assert.deepEqual(su?.permissions, ["*"]);
  assert.equal(su?.mfa, true);
  const emp = m.find((x) => x.role === "employee");
  assert.equal(emp?.permissions.includes("employee.read_all"), false);
  assert.equal(emp?.mfa, false);
  assert.equal(m.find((x) => x.role === "it_admin")?.permissions.includes("user.manage"), true);
});

test("session is valid only while token version matches (revocation)", () => {
  assert.equal(isSessionCurrent(3, 3), true);
  assert.equal(isSessionCurrent(2, 3), false); // user's version bumped → old token dead
  assert.equal(isSessionCurrent(undefined, 0), false); // legacy token without a version
  assert.equal(isSessionCurrent("3", 3), false); // wrong type never passes
});
