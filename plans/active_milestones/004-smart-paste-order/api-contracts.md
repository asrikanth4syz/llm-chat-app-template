# API Contracts — Smart Paste Order (V1)

Two new endpoints. Both reuse `getUser`/`requireUser` and `denyClientCrossAccess`. Internal
roles (super_admin, ops_admin) pass the tenancy check for any client; client_admin only for
their own scope (that is exactly `denyClientCrossAccess`'s existing behaviour → 404 on mismatch).

Role gate for both: `super_admin | ops_admin | client_admin` → else **403**. Then
`denyClientCrossAccess(env, user, client_id)` → **404** on cross-tenant. (401 if unauthenticated.)

---

## 1. `POST /api/orders/parse-paste` — parse + match (writes only parse-phase log rows)

### Request
```json
{ "client_id": "C123", "text": "Goodday 100 - 10\nWater 20\n..." }
```
**Validation:** `client_id` required (else 400 malformed); `text` required and, after splitting on `/\r\n|\r|\n/`, must contain ≥ 1 parseable line (R2-C13) else 400; **≤ 200 raw lines and ≤ 20,000 Unicode code points of the raw text, counted before filtering** (R2 D6-rev) else 400 with the limit named. A nonexistent/not-owned `client_id` → 404 (uniform, R2-C1).

### Response 200
```json
{
  "client_id": "C123",
  "parse_session_id": "a1b2c3…",
  "lines": [
    {
      "line_no": 1,
      "raw": "Goodday 100 - 10",
      "product_text": "Goodday 100",
      "quantity": 10,
      "qty_suggested": null,
      "unit_hint": null,
      "status": "unmatched",
      "needs_qty": false,
      "parse_flags": [],
      "candidates": [
        { "sku": "BISC-GD-100", "name": "Britannia Good Day 100g", "price": 42,
          "confidence": 96, "tier": "history", "why": ["ordered 8×"] }
      ],
      "selected_sku": null
    }
  ],
  "summary": { "total": 4, "matched": 2, "unmatched": 1, "needs_qty": 1, "pool_truncated": false }
}
```
- `status ∈ {matched, unmatched}`; `needs_qty` is a separate boolean (R2-C7). `selected_sku` = top candidate when `status==matched`, else null.
- `parse_flags ⊆ {low_confidence_parse, coerced_decimal, rejected_fraction, qty_suggested}` (R2-C8).
- `pool_truncated` is **summary-level** only (R2-C8/C12).
- Side effects: writes one `phase='parse'` `paste_match_log` row per surviving line (R2-C10); creates **no** order; mutates no catalogue/inventory. Re-parsing the same text creates a **new** `parse_session_id` (old orphan rows purged at 30 days).
- Target: p95 ≤ 50 ms CPU, 100 lines × 2,000-SKU pool, index-build included (R2-C12).

## 2. `POST /api/orders/from-paste` — Confirm → DRAFT order (atomic)

### Request
```json
{
  "client_id": "C123",
  "parse_session_id": "a1b2c3…",
  "idempotency_key": "client-generated-uuid",
  "lines": [
    { "line_no": 1, "chosen_sku": "BISC-GD-100", "quantity": 10, "action": "accepted", "merge_group": null }
  ],
  "notes": "optional"
}
```
- `action ∈ {accepted, changed, searched, removed, merged}` (removed lines may be omitted instead; if present they are logged, not ordered).
- `merge_group`: lines sharing a non-null `merge_group` the operator chose to merge are summed into one `order_items` line (R2-D3, operator-confirmed).

### Server behaviour — ALL in one `env.DB.batch([...])` (R2-D4/D3-rev)
0. `await ensureFeatureTables(env)` at entry (cold-isolate schema guarantee).
1. Role gate + `denyClientCrossAccess`.
2. **Idempotency:** `SELECT order_id FROM paste_idempotency WHERE idempotency_key=?` → on hit return that `order_id` (201, replayed), write nothing. On miss, the INSERT into `paste_idempotency` is one statement of the batch in step 6, so a concurrent/retried replay cannot create a second order.
3. Re-derive the client's candidate pool = current `client_catalog` SKUs (R2-C2). For every non-removed line: reject **422** if `chosen_sku ∉ pool` or `quantity` is not an integer ≥ 1 (name the offending `line_no`s; create no draft — R2-C14 TOCTOU).
4. Price each line `COALESCE(cc.client_price, inv.unit_price)`; apply operator merges (sum qty per `merge_group`).
5. Require ≥ 1 resolved line else 400 (R2-C14).
6. Batch: INSERT `orders` (`status='DRAFT'`, `source='smart_paste'`, `subtotal`, `gst` via `computeOrderGst`, SP- id) + INSERT `paste_idempotency(idempotency_key, order_id, client_id)` + one `order_items` per resolved/merged line + `order_history` DRAFT row + **UPSERT** each `paste_match_log` row to `phase='confirm'` with `order_id`, `chosen_sku`, `action`. **UPSERT, not bare UPDATE:** a line added via manual search / merge may have no parse-phase `(parse_session_id,line_no)` row, so INSERT a confirm row when none exists — otherwise the confirm row is lost and the "one row per line" metric breaks.
7. Return `{ "id": "SP-…", "status": "DRAFT", "grand_total": 1234 }` (201). The UI then `navigate`s to the normal order screen for that id (R2-D6).

### Errors
- 400 malformed / zero resolved lines; 403 role; 404 cross-tenant; 422 SKU-not-in-pool or bad qty (with `line_no`s); 409 optional on idempotency race (else replay 201).

## 3. Config (R2-D1)
`app_config` keys read via `getConfig`: `smartpaste_match_min` (default `"0.5"`, valid [0.3,0.9]), `smartpaste_match_margin` (default `"0.05"`). Out-of-range → clamp + log; do not crash.
