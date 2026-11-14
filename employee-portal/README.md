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
# Asha logs in and sees only herself:
TOKEN=$(curl -s localhost:8787/api/auth/login -d '{"email":"asha@4syz.com","password":"pw123"}' | jq -r .token)
curl -s localhost:8787/api/employees -H "Authorization: Bearer $TOKEN"   # → just Asha
curl -s localhost:8787/api/employees/e_bala -H "Authorization: Bearer $TOKEN"   # → 403 forbidden
# Super admin sees everyone, with sensitive fields:
TOKEN=$(curl -s localhost:8787/api/auth/login -d '{"email":"admin@4syz.com","password":"pw123"}' | jq -r .token)
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
npx wrangler secret put JWT_SECRET      # a long random string — separate realm from SmartPantry
```

Then push a change under `employee-portal/` to `main` (or run the workflow
manually). CI applies the migrations and deploys. Check the first login with the
seed users, then rotate/disable them.

Deploy from your machine instead (from `employee-portal/`):
`npm install && npm run migrate:remote && npm run deploy`.

## Endpoints (R0)

| Method | Path | Who | Returns |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | anyone | JWT; privileged roles must also send `otp` (dev `000000`) — MFA, DEC-02 |
| GET | `/api/me` | any login | own employee record (full detail) |
| GET | `/api/employees` | any login | scoped list — self / team / all by role |
| GET | `/api/employees/:id` | any login | one record if policy allows, else 403 (+ DENY audit) |
| GET | `/api/audit` | auditor, super_admin | recent audit entries |
| GET | `/api/policy/matrix` | it_admin, auditor, super_admin | role → permission matrix (G1 artefact) |
| POST | `/api/admin/users/:id/revoke` | it_admin, super_admin | kill a user's sessions (`{"deactivate":true}` also disables login) |

## MFA & access revocation

- **MFA (DEC-02):** HR, Finance, IT/Admin, Auditor and super_admin logins require a
  second factor at `/api/auth/login` (dev OTP `000000`; replace with TOTP / DLT SMS).
  Employee and manager logins stay single-factor.
- **Revocation (SLA):** each login carries a token version; `…/revoke` bumps the
  user's version so **every live session for them is rejected immediately** — the
  "sessions killed within 1 h of exit or role change" control. Flip `deactivate`
  to also disable the account.

## Not yet (later in R0 / R1), from PRD v1.4

Real SSO + DLT mobile-OTP (replacing the dev password/OTP); field-level encryption
(NFR-03); numeric NFRs and CERT-In/DPDP logging retention; PostgreSQL + RLS; the
data inventory/retention matrix and ADR as signed G1 artefacts.
