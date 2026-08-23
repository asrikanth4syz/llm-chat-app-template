# Smart Pantry — Production Deploy Runbook

Cloudflare Worker + D1 (`smart-pantry` / `smart-pantry-db`). Deploys run from
GitHub Actions (`.github/workflows/deploy.yml`) on push to `main` or via the
Actions **Run workflow** button. Tests + typecheck must pass before it ships.

---

## 1. One-time setup (per environment)

**Required secrets** (set with `wrangler secret put …`, never in `wrangler.jsonc`):

| Secret | Why |
| --- | --- |
| `JWT_SECRET` | Signs auth tokens. **Prod refuses to serve (503) without a strong one.** Generate: `openssl rand -base64 48` |
| `BOOTSTRAP_ADMIN_EMAIL` | First real admin (seed accounts are disabled in prod) |
| `BOOTSTRAP_ADMIN_PASSWORD` | Password for that admin (min 10 chars) |

```bash
wrangler secret put JWT_SECRET
wrangler secret put BOOTSTRAP_ADMIN_EMAIL
wrangler secret put BOOTSTRAP_ADMIN_PASSWORD
```

Set `APP_ENV=production` for the production deployment (the fail-closed secret
check and seed-account disabling key off this).

**CI secrets** (GitHub → repo settings → Secrets): `CLOUDFLARE_API_TOKEN`
(scopes: Workers Scripts _write_ + D1 _write_) and `CLOUDFLARE_ACCOUNT_ID`.

Optional integrations are blank by default and safe to leave unset: `ZOHO_*`,
`TWILIO_*`, `MSG91_*`, `EMAIL_*`, `OTP_ENABLED`.

---

## 2. Schema / migrations

The D1 was bootstrapped at runtime, so it has **no wrangler migration history** —
do **not** run `wrangler d1 migrations apply` (it would replay `0001+` and
collide). Schema is managed by a **version-gated bootstrap** in `src/index.ts`:

- `runBootstrap()` self-heals schema + data once per `BOOTSTRAP_VERSION`, then
  becomes a cheap no-op (one `SELECT`). It runs in `waitUntil`, never blocking a
  response.
- **To add feature tables / data migrations:** add the idempotent DDL/DML to
  `ensureFeatureTables` / `fixCategoryNames`, then **bump `BOOTSTRAP_VERSION`**.
  The heavy path re-runs exactly once after deploy.

The deploy workflow's warmup step triggers the bootstrap and hits `/api/health`
right after deploy, so it happens at deploy time rather than on a user request.

---

## 3. Deploy

- **Automatic:** push to `main`.
- **Manual:** Actions → **Deploy** → **Run workflow** (used for the feature
  branch during development).

Pipeline: `npm ci` → `tsc --noEmit` → `vitest run` → `wrangler deploy` → warmup +
health check. A red build never ships.

---

## 4. Verify after deploy

```bash
curl -fsS https://<worker-url>/api/health
# {"status":"ok","db":"ok","version":"<BOOTSTRAP_VERSION>","time":"…"}
```

- `status: ok` + `db: ok` → live.
- `503` in prod → `JWT_SECRET` not set (expected until step 1 is done).

Then log in as the bootstrap admin and confirm **Admin & Settings → System
Health** loads.

---

## 5. Observability & alerting

- **In-app:** Super Admin → **System Health** — error volume (1h/24h), the last
  20 failures with `request_id`, and live metrics. Every 500 response returns a
  `request_id`; users should quote it when reporting problems.
- **Endpoints:** `GET /api/health` (public liveness — point an uptime monitor
  here), `GET /api/observability` (staff-only snapshot).
- **Logs:** structured `{"level":"error", …}` lines go to **Cloudflare Workers
  Logs** (observability is enabled in `wrangler.jsonc`).
- **Set up (Cloudflare dashboard):** an alert on the Worker's 5xx rate, and
  optionally a Logpush/Tail rule filtering `"level":"error"`.

---

## 6. Security posture (already enforced in code)

- Prod won't serve on a weak/default/short `JWT_SECRET`.
- Seed accounts are disabled in prod; the well-known password is never accepted.
- Authorization is enforced per endpoint: external client/vendor accounts are
  confined to their own tenant and blocked from back-office/admin routes; a
  central guard denies external roles the admin surfaces and all-client reports.
- Delivery/GRN stock changes are idempotent (unique `movement_key`) — retries /
  double-submits can't double-spend inventory.
- AI endpoints (extract / OCR / ai-health) are per-user rate-limited.

---

## 7. Rollback

Cloudflare keeps prior Worker versions — roll back from the **Workers →
Deployments** page (or `wrangler rollback`). D1 data is **not** reverted by a
Worker rollback; the bootstrap is forward-only (adding tables/columns, never
dropping), so an older Worker runs safely against the newer schema. Enable D1
Time Travel / backups for point-in-time data recovery.
