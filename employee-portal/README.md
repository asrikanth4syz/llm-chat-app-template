# 4SYZ Employee Portal — R0 foundation

> **Lives inside the SmartPantry repo (`employee-portal/`), but is its own system**
> — separate Cloudflare **Worker** (`employee-portal`), separate **D1**
> (`employee-portal-db`), separate **identity realm** and `JWT_SECRET`. SmartPantry
> and the portal share nothing but the git repo and the CI runner; they deploy on
> independent, path-filtered pipelines. This is the "Option B" boundary: one repo to
> clone and one pipeline to know, without co-mingling HR PII with ERP data or auth.

The start of the people platform (Employee Portal), per **PRD v1.4 → Release R0**.
This slice stands up the security foundation everything else is built on:

- **Separate identity realm** from SmartPantry (own `users` table, own `JWT_SECRET`) — DEC-02.
- **RBAC + policy engine, default deny** (`src/policy.ts`) — the single source of truth for who may see what.
- **Strict record scoping** — the headline R0 rule:
  - every login sees **strictly its own** employee record;
  - a **manager** also sees its team;
  - **HR / Finance / Auditor** see all records for their function;
  - **super_admin** sees **everything**, including all sensitive fields.
- **Sensitive-field redaction** (PAN, bank, Aadhaar, CTC) — shown only to the owner and to roles with sensitive-read-all.
- **Append-only audit log** — inserts only; DB triggers block any update/delete (not even System Administrator can alter it).

> D1 (SQLite) has no row-level security, so **every scope check lives in Worker code** and is unit-tested directly — the IDOR safety net the PRD requires. Production adds **PostgreSQL + RLS** as a second layer.

## Prove the isolation rule (no install needed)

```bash
cd employee-portal
npm test          # node --test, strips TS types; proves the access-control core
```

`test/policy.test.ts` asserts: an employee sees only their own record; one employee cannot reach another's (IDOR denied both ways); a manager sees the team but not the team's sensitive fields; super_admin sees all records and all sensitive fields; default deny.

## Run locally

```bash
npm install
wrangler d1 create employee-portal-db        # paste the id into wrangler.jsonc
npm run migrate:local                        # schema + seed logins
echo "dev-secret" | wrangler secret put JWT_SECRET   # or set in .dev.vars for `wrangler dev`
npm run dev
```

Dev logins (password `pw123`): `admin@4syz.com` (super_admin), `hr@4syz.com` (HR), `meera@4syz.com` (manager), `asha@4syz.com` / `bala@4syz.com` (employees).

```bash
# Asha logs in (2FA for all → password + otp) and sees only herself:
TOKEN=$(curl -s localhost:8787/api/auth/login -d '{"email":"asha@4syz.com","password":"pw123","otp":"000000"}' | jq -r .token)
curl -s localhost:8787/api/employees -H "Authorization: Bearer $TOKEN"   # → just Asha
curl -s localhost:8787/api/employees/e_bala -H "Authorization: Bearer $TOKEN"   # → 403 forbidden
# Omitting "otp" now returns {"mfa_required":true} for every role, employee included.
# Super admin sees everyone, with sensitive fields:
TOKEN=$(curl -s localhost:8787/api/auth/login -d '{"email":"admin@4syz.com","password":"pw123","otp":"000000"}' | jq -r .token)
curl -s localhost:8787/api/employees -H "Authorization: Bearer $TOKEN"   # → all, incl. pan/bank/ctc
```

## Deploy

A **dedicated** workflow, `.github/workflows/employee-portal.yml` (at the repo
root), is **path-filtered to `employee-portal/**`** — it typechecks, runs the
access-control tests, applies the D1 migrations and deploys the portal Worker on
every push to `main` that touches this folder. A SmartPantry-only change never
triggers it, and a portal change never redeploys SmartPantry.

The D1 database already exists (`employee-portal-db`, id in `wrangler.jsonc`), and
the repo already carries the `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`
secrets (SmartPantry uses the same Cloudflare account). So the only one-time step
left before logins work is the portal's **own** app secret:

```bash
cd employee-portal
npx wrangler secret put JWT_SECRET            # a long random string — separate realm from SmartPantry
openssl rand -base64 32 | npx wrangler secret put FIELD_ENC_KEY   # NFR-03 field-encryption key
```

`FIELD_ENC_KEY` (base64 of 32 bytes) encrypts bank/PAN/Aadhaar at rest. Reads of the
plaintext scaffold seed work without it; **submitting an encrypted change (bank/PAN/
Aadhaar) requires it** (returns 501 until set). Never rotate it without re-encrypting
existing values, or they become unreadable.

Then push a change under `employee-portal/` to `main` (or run the workflow
manually). CI applies the migrations and deploys. Check the first login with the
seed users, then rotate/disable them.

Deploy from your machine instead (from `employee-portal/`):
`npm install && npm run migrate:remote && npm run deploy`.

## UI (FR-01 Profile + FR-03 Leave + FR-02 Attendance + FR-08 Directory)

The Worker serves a mobile-first SPA from `public/` (static-assets binding in
`wrangler.jsonc`; `/api/*` still falls through to the Worker), with **Profile**,
**Leave**, **Attendance** and **Directory** tabs. Open the Worker URL in a browser:

- **Sign in** with email + password + the 2FA code (dev `000000`).
- **Profile** — employment details (read-only), contact fields you can edit inline
  (phone, personal email, address, emergency contact → apply immediately), and the
  identity/financial block **masked by default** with per-field **Reveal** (logged)
  and **Request change** (bank/PAN/Aadhaar → encrypted pending request). HR/super_admin
  get a **Verification queue** for pending identity changes.
- **Leave** — balances per type (entitled / used / pending / available), an apply form
  (type, dates, half-day, reason), your request history with **Cancel**, and — for
  managers (team) and HR/super_admin (all) — a **Leave approvals** queue.
- **Attendance** — pick a month: per-day IN/OUT, worked hours and status from the
  biometric system, with **exception flags** (missing punch, absence, short hours);
  a **Request correction** form (regularisation / on-duty / client visit / WFH);
  your corrections; and, for managers/HR, a **Correction approvals** queue.
- **Directory** — search all colleagues by name / role / location; shows name,
  designation, location, segment, work email and manager only. No salary, bank,
  identity or personal contact.
- Language switcher: **English / ಕನ್ನಡ / हिन्दी** (kn/hi strings are initial — have a
  native speaker review before go-live).

## Endpoints (R0 + R1: FR-01, FR-03)

| Method | Path | Who | Returns |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | anyone | JWT; **all** roles must also send `otp` (dev `000000`) — 2FA for all, DEC-02 |
| GET | `/api/me` | any login | own profile; sensitive fields **masked** — `?reveal=pan,bankAccount,aadhaarLast4` returns full + logs REVEAL |
| GET | `/api/employees` | any login | scoped list — self / team / all by role, sensitive fields masked |
| GET | `/api/employees/:id` | any login | one record if policy allows (masked; `?reveal=…`), else 403 (+ DENY audit) |
| GET | `/api/directory?q=` | any login | FR-08: all colleagues' public fields (name, designation, location, segment, work email, manager); salary/bank/identity/personal contact never selected |
| POST | `/api/profile/change` | any login | FR-01: `{field,value}`. Direct fields (phone, personalEmail, address, emergencyContact) apply now; bank/PAN/Aadhaar → encrypted **pending** request |
| GET | `/api/profile/changes` | any login | own change requests (status; encrypted value never returned) |
| POST | `/api/admin/profile/changes/:id/approve`·`/reject` | hr_admin, super_admin | verify a pending bank/identity change (`profile.verify`) |
| GET | `/api/audit` | auditor, super_admin | recent audit entries |
| GET | `/api/policy/matrix` | it_admin, auditor, super_admin | role → permission matrix (G1 artefact) |
| POST | `/api/admin/users/:id/revoke` | it_admin, super_admin | kill a user's sessions (`{"deactivate":true}` also disables login) |
| GET | `/api/leave/types` · `/api/leave/balances` | any login | FR-03: leave types; own balances (entitled/used/pending, current year) |
| GET·POST | `/api/leave/requests` | any login | own requests; submit `{leaveTypeId,startDate,endDate,halfDay?,reason?}` (409 if over balance) |
| POST | `/api/leave/requests/:id/cancel` | owner | cancel own pending/approved request (approved restores balance) |
| GET | `/api/leave/approvals` | manager, hr_admin, super_admin | pending requests to decide — team for a manager, all for HR |
| POST | `/api/leave/requests/:id/approve`·`/reject` | manager (team), hr_admin, super_admin | decide `{comment?}`; self-approval blocked; approve adds to `used` |
| POST | `/api/admin/attendance/import` | hr_admin, it_admin, super_admin | FR-02: ingest biometric rows `{month,rows[]}`; matches `attendance_code`→employee, upserts days, reports unmatched codes |
| GET | `/api/attendance?month=YYYY-MM` | any login | own days (IN/OUT/work/status) + per-day exceptions + monthly summary |
| GET·POST | `/api/attendance/corrections` | any login | own corrections; submit `{date,type,requestedIn?,requestedOut?,reason?}` |
| GET | `/api/attendance/corrections/approvals` | manager, hr_admin, super_admin | pending corrections — team for a manager, all for HR |
| POST | `/api/attendance/corrections/:id/approve`·`/reject` | manager (team), hr_admin, super_admin | decide; approve writes the day back (status P, source manual) |

## FR-02 Attendance (biometric)

Daily punches come from the biometric attendance system's **monthly report** (an `.xls`
of 10-row blocks per employee). Flow:

1. Map each person's biometric **Empcode** to their portal record (`employees.attendance_code`).
   Migration `0005` sets a demo mapping for the seed users.
2. Convert the report to the import payload and POST it (one-time per month):
   ```bash
   pip install xlrd
   python3 employee-portal/scripts/parse_biometric.py monthreport.xls > import.json
   TOKEN=$(curl -s $URL/api/auth/login -d '{"email":"hr@4syz.com","password":"pw123","otp":"000000"}' | jq -r .token)
   curl -s $URL/api/admin/attendance/import -H "Authorization: Bearer $TOKEN" \
        -H 'content-type: application/json' --data-binary @import.json
   ```
   The response reports `imported`, matched `employees`, and any `unmatchedCodes`.
3. Employees see their month in the **Attendance** tab; **exceptions** flag missing
   punches, absences and short hours (future days are not flagged).
4. **Corrections** (regularisation / on-duty / client-visit / WFH) go through the same
   manager→team / HR→all approval scoping as leave (self-approval blocked); an approved
   correction writes the day back as a manual record. Payroll cut-off locking (FR-16,
   e.g. the 25th) and working-day/holiday-calendar hour counting are follow-ups.

## FR-03 Leave

- **Balances change only after approval** — a pending request is checked against
  `entitled − used − pending`; approval moves days into `used`; cancelling an approved
  request restores them. Leave types + quotas seed in migration `0004` (CL 12, SL 12, EL 15).
- **Approval scope** — a manager decides only for direct reports (`leave.approve_team`),
  HR/super_admin for anyone (`leave.approve_all`); **self-approval is blocked** (FR-04).
- Days are inclusive calendar days (half-day for a single day). Working-day /
  per-location-holiday-calendar counting is a follow-up.

## FR-01 Profile & NFR-03 field encryption

- **Masked by default (NFR-03):** bank account, PAN and Aadhaar are returned masked
  (`••••••234F`) to everyone, including the owner and super_admin. A per-field
  `?reveal=` shows the full value and writes a `REVEAL` audit row (reveal-on-click).
  CTC is sensitive but not masked (a number), still gated by the policy engine.
- **Encrypted at rest:** those three fields are stored AES-256-GCM encrypted
  (`src/fieldcrypto.ts`); legacy plaintext (scaffold seed) still reads. Decryption
  happens in-Worker before the policy engine masks.
- **Controlled changes (FR-01):** an employee edits direct fields themselves; a
  bank/PAN/Aadhaar change is stored **encrypted** as a *pending* request and only
  applies after HR/super_admin approval. Step-up auth on these is R2 (FR-26).

## 2FA & access revocation

- **2FA for all (DEC-02, extended):** *every* login — employee and manager included —
  must present a second factor at `/api/auth/login` (dev OTP `000000`). The flow is
  enforced for all roles now; the real factor (TOTP / DLT mobile-OTP) replaces the
  stub later via `verifyOtp` in `src/auth.ts`. No role is single-factor.
- **Revocation (SLA):** each login carries a token version; `…/revoke` bumps the
  user's version so **every live session for them is rejected immediately** — the
  "sessions killed within 1 h of exit or role change" control. Flip `deactivate`
  to also disable the account.

## Not yet (later in R0 / R1), from PRD v1.4

Real SSO + DLT mobile-OTP (replacing the dev password/OTP); field-level encryption
(NFR-03); numeric NFRs and CERT-In/DPDP logging retention; PostgreSQL + RLS; the
data inventory/retention matrix and ADR as signed G1 artefacts.
