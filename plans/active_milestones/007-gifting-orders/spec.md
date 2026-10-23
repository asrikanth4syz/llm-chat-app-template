# Product Specification: Gifting Orders — a distinct multi-step fulfilment workflow

> Builds on the shipped Quotations module (`006-quotations`) and the existing
> Orders/Warehouse/Delivery flow. A quote now carries a **fulfilment kind**
> (`REGULAR` | `GIFTING`, shipped in the Quotations slice that precedes this
> milestone). A **REGULAR** quote converts to the normal order (pick → pack →
> deliver). A **GIFTING** quote converts to a **GIFTING ORDER**: a distinct,
> separately-tracked order whose items each run a procurement → branding →
> client-approval → consolidation path before they enter the normal delivery flow.

## 🎯 Executive Summary
- **Goal:** When an accepted **Gifting** quote is converted, create a dedicated **gifting order** whose **each line item** is tracked through its own workflow — *order → receive → branding (where applicable) → sample to client → client approval → collect at office* — and then **dispatch what's ready** (partial allowed) into the normal delivery process. Gifting orders live in their **own pipeline**, visibly distinct from regular orders.
- **Target user:** Ops / warehouse staff running gifting fulfilment (primary); sales/account owner who sees status; the **client**, who approves branding samples via a shared link (external, read-limited).
- **Business value:** Corporate gifting (e.g. Diwali hampers) is not a pick-and-ship order — items are procured per-item, branded, and must be client-approved before consolidation. Today that is tracked off-system (spreadsheets / chat). This makes the multi-step reality first-class, auditable, and reportable, without bending the regular order flow around it.

## 🔑 Decisions locked with the product owner
1. **Mixed branding** — one gifting order **can mix** branded and non-branded items. Non-branded items **skip** branding/sample/approval and go Received → At office. *(answer: yes)*
2. **Client approval channel** — the **client approves** the branding sample (not ops-on-behalf). Phase 1 models a shared **approval link**; ops can see status but the approve/reject decision is the client's. *(answer: client will approve)*
3. **Partial consolidation / dispatch** — **partial is allowed.** Items that reach *At office* can be dispatched into delivery without waiting for the rest. *(answer: partially as well)*
4. **Procurement** — **Phase 1 is a simple flow:** per item, **select a vendor from a dropdown** and mark ordered. No PO documents, GRN, or costing in Phase 1. *(answer: simple, vendor dropdown)*
5. **Sample rejection** — a rejected sample loops the item **back to Branding** only (re-brand and re-sample). It does **not** bounce to re-order. *(answer: back to branding)*
6. **Reporting** — gifting orders are a **separate pipeline / tab**, not a filter on the regular orders list. *(answer: separate pipeline)*

## 🧩 Scope (and non-scope)
**In scope (Phase 1):**
1. **Quote → gifting fork** *(already shipped on the quote):* `quotes.kind` (`REGULAR|GIFTING`), chosen as the first field in the quote editor; convert carries it to `orders.order_kind`.
2. **Gifting order creation** — converting an **ACCEPTED, GIFTING** quote creates an order with `order_kind='GIFTING'` and seeds one **gifting item** per line with its per-item workflow state.
3. **Per-item workflow state machine** — `TO_ORDER → ORDERED → RECEIVED → [BRANDING → SAMPLE_SENT → APPROVED →] AT_OFFICE → DISPATCHED`, branded bracket skipped for non-branded items.
4. **Simple per-item procurement** — pick a vendor from a dropdown; mark ordered; mark received.
5. **Branding + sample + client approval** — flag items that need branding; record a sample (reference/photo) sent to the client; capture the **client's** approve/reject via a tokenised link; reject → back to BRANDING.
6. **Consolidation + partial dispatch** — an "at office" meter; dispatch the ready subset into the existing delivery flow; the gifting order closes when all items are DISPATCHED.
7. **Separate Gifting pipeline** — a distinct board/tab listing gifting orders with per-order rollup status and the consolidation meter.
8. **Audit** — every item transition and the client approval decision are logged on the order history.

**Explicitly deferred (NON-scope, Phase 2+):**
- Full procurement (PO documents, GRN, landed cost, vendor bills) for gifting items.
- Branding cost capture / margin on gifting (Phase 1 branding is a status, not a priced line).
- Client portal beyond the single tokenised sample-approval page.
- Automated vendor emails / RFQs; inventory reservation; barcode scan of gifting items.
- Multi-sample rounds history UI beyond the latest sample + decision (data model keeps rounds; UI shows current).

## 👤 User Stories & Workflows
- **As ops**, when an accepted gifting quote is converted, I get a **gifting order** with every line item listed and each sitting at *To order*, so I can start procurement.
- **As ops**, for each item I **pick a vendor** and mark it **ordered**, then **received** when it arrives.
- **As ops**, for a branded item I **start branding**, then **send a sample to the client** (attach a reference); non-branded items skip straight to *collect at office*.
- **As the client**, I open a link, see the sample, and **Approve** or **Reject** (with a reason); on reject the item returns to branding for a re-sample.
- **As ops**, once an item is approved (or, if non-branded, received) I **collect it at office**; when enough are ready I **dispatch the ready items** into delivery — I don't have to wait for the whole order.
- **As a sales/account owner**, I open the **Gifting pipeline** and see each gifting order's rollup stage and how many items are ready, distinct from regular orders.

## 🔁 Per-item state machine
```
            ┌────────────── non-branded: skip branding bracket ──────────────┐
            │                                                                 ▼
TO_ORDER ─▶ ORDERED ─▶ RECEIVED ─▶ BRANDING ─▶ SAMPLE_SENT ─▶ APPROVED ─▶ AT_OFFICE ─▶ DISPATCHED
   │(vendor)   │(recv)     │(branded?)   ▲   (client)  │(reject→)                 │(partial OK)
   │           │           └──no────────┼───────────────┘                        │
   └───────────┴──────── advance guards ┘                                        ▼
                               reject: SAMPLE_SENT ──▶ BRANDING            (enters normal delivery)
```
- **Advance guards:** `TO_ORDER → ORDERED` requires a `vendor_id`. `RECEIVED → BRANDING` only when `needs_branding=1`; otherwise `RECEIVED → AT_OFFICE`. `SAMPLE_SENT` transitions are **client-driven** (link); every other transition is **ops-driven**.
- **Reject loop:** `SAMPLE_SENT --reject--> BRANDING` (records a reason, keeps the sample-round history).
- **Order rollup** (derived, least-advanced item): `PROCURING → PREP/BRANDING → AWAITING_APPROVAL → CONSOLIDATING → READY/FULFILLING → DONE`.
- **Order close:** when every item is `DISPATCHED` the gifting order is `FULFILLED` (the dispatched subsets flow through the existing delivery/DC process unchanged).

## 🗄️ Data Model (new; additive, self-healed like the quote tables)
All tables created idempotently in an `ensureGiftingSchema(env)` self-heal runner (one statement per
`prepare().run()`, once-per-isolate guard), mirroring the quote-module convention. **No `REAL` money**
in Phase 1 (branding/procurement carry no money yet); quantities are integers.

```
orders
  order_kind   TEXT DEFAULT 'REGULAR'      -- 'REGULAR' | 'GIFTING'  (already added at the quote slice)

gifting_items                               -- one row per gifting order line
  id             TEXT PRIMARY KEY
  order_id       TEXT NOT NULL              -- FK orders.id
  sku            TEXT
  name           TEXT NOT NULL
  qty            INTEGER NOT NULL
  needs_branding INTEGER NOT NULL DEFAULT 0 -- 1 ⇒ runs branding bracket
  stage          TEXT NOT NULL DEFAULT 'TO_ORDER'
  vendor_id      TEXT                       -- chosen from the vendor dropdown (Phase 1)
  vendor_name    TEXT                       -- denormalised label for display
  ordered_at     TEXT
  received_at     TEXT
  collected_at    TEXT                      -- "at office"
  dispatched_at   TEXT
  updated_at      TEXT DEFAULT (datetime('now'))
  created_at      TEXT DEFAULT (datetime('now'))

gifting_samples                             -- branding sample rounds + client decision
  id            TEXT PRIMARY KEY
  item_id       TEXT NOT NULL               -- FK gifting_items.id
  round         INTEGER NOT NULL DEFAULT 1  -- increments on each re-sample after a reject
  ref           TEXT                        -- sample reference / note / image key
  sent_at       TEXT DEFAULT (datetime('now'))
  approval_token TEXT                       -- tokenised client-approval link (opaque, single item)
  decision      TEXT                        -- NULL | 'APPROVED' | 'REJECTED'
  decided_at    TEXT
  reject_reason TEXT

-- gifting order history reuses the existing order_history table (one actor row per transition),
-- with actor_name = 'client' for the sample decision.
```
**Derivations (not stored):** order rollup stage and the "N / total at office" meter are computed from
`gifting_items.stage`; a gifting order never stores a rollup column (resolves drift).

## 🌐 API contract (new routes; `order_kind='GIFTING'` guarded)
| Method & path | Purpose | Notes |
|---|---|---|
| `POST /api/quotes/:id/convert` | *(existing)* now seeds `gifting_items` when the quote `kind='GIFTING'` | one `gifting_items` row per line, `needs_branding` default 0 (ops sets it) |
| `GET /api/gifting-orders` | list gifting orders (separate pipeline) | rollup stage + ready meter per order |
| `GET /api/gifting-orders/:id` | one gifting order + its items + latest sample per item | |
| `POST /api/gifting-items/:id/vendor` `{vendor_id}` | set vendor | guard: stage `TO_ORDER` |
| `POST /api/gifting-items/:id/advance` | ops advance to the next stage | server computes next stage + enforces guards (vendor set, branded bracket) |
| `POST /api/gifting-items/:id/sample` `{ref}` | record a sample sent → `SAMPLE_SENT`, mint `approval_token` | guard: stage `BRANDING` |
| `GET /api/gifting-approve/:token` | **public** sample view for the client | read-limited; no auth; token-scoped to one item/round |
| `POST /api/gifting-approve/:token` `{decision, reason?}` | client approve/reject | approve → `APPROVED`; reject → `BRANDING` (+reason, round+1 on next sample) |
| `POST /api/gifting-orders/:id/dispatch` | dispatch all `AT_OFFICE` items (partial) into delivery | moves those items → `DISPATCHED`, creates/advances the delivery per existing flow |

**Authorisation:** all `/gifting-*` ops routes require an authenticated warehouse/ops role (reuse the
existing order-pick role gate). The **public approval** routes are **token-only**, rate-limited, and expose
only the item name, qty, sample reference and the approve/reject action — never costs, other items, or the
order total.

## 🖥️ UI surface
- **Quote editor:** *(shipped)* first field **Quote type — Regular / Gifting**; helper text explains the fork.
- **Gifting pipeline tab** (separate): cards/rows of gifting orders with the rollup stepper + "N / total ready" meter; opens the board.
- **Gifting order board** (mock: `scratchpad/gifting-order-mock.html`): one card per item — identity + *Needs branding* tag, vendor dropdown (when `TO_ORDER`), a mini step tracker (dashed = skipped for non-branded), the current-stage chip, and the context action (Place order / Mark received / Start branding / Send sample / Collect at office). "Sample sent" shows *awaiting client approval*. Header: **Dispatch ready (N)** (partial) + consolidation meter.
- **Client approval page** (public, token): the sample reference, item + qty, **Approve** / **Reject (reason)** — nothing else.

## ✅ Acceptance criteria (Gherkin)
```
Scenario: Converting a gifting quote creates a gifting order
  Given an ACCEPTED quote with kind = GIFTING and 3 lines
  When it is converted
  Then an order is created with order_kind = GIFTING
  And exactly 3 gifting_items are seeded, each at stage TO_ORDER
  And it appears in the Gifting pipeline, not the regular orders list

Scenario: Non-branded item skips the branding bracket
  Given a gifting item with needs_branding = 0 at stage RECEIVED
  When ops advances it
  Then its stage becomes AT_OFFICE (not BRANDING)

Scenario: Branded item requires client approval
  Given a branded gifting item at stage BRANDING
  When ops sends a sample
  Then the item is SAMPLE_SENT and an approval token is minted
  And ops cannot advance it past SAMPLE_SENT themselves

Scenario: Client rejects a sample
  Given a gifting item at stage SAMPLE_SENT
  When the client opens the token link and rejects with a reason
  Then the item returns to stage BRANDING with the reason recorded
  And a new sample round starts the next time ops sends a sample

Scenario: Partial dispatch
  Given a gifting order with 2 of 5 items at AT_OFFICE
  When ops dispatches ready items
  Then those 2 items become DISPATCHED and enter the delivery flow
  And the other 3 remain in their current stages
  And the order is not yet FULFILLED

Scenario: Advance guard on vendor
  Given a gifting item at stage TO_ORDER with no vendor
  When ops tries to mark it ordered
  Then the transition is rejected until a vendor is chosen
```

## 🔒 Non-functional / guardrails
- **Tenancy & access** mirror the orders module; gifting routes reuse the order role gate; the public approval route is token-scoped and leaks no cost/margin or sibling-item data.
- **Idempotency:** convert is already idempotent (`converted_order_id` guard); item seeding is part of the same batch, so a replayed convert never double-seeds.
- **Auditability:** every item transition and the client decision write an `order_history` row; the sample token records who/when.
- **Self-heal schema** + a parity migration file, consistent with the quote module.
- **No regression:** a REGULAR quote's convert path and the regular order/pick/deliver flow are byte-for-byte unchanged; gifting behaviour is entirely behind `order_kind='GIFTING'`.

## 🚧 Open questions for Phase 2 (not blocking Phase 1)
- ✅ **BUILT (Slice 4):** Branding **cost + margin** capture — each gifting item now carries a
  buying cost and a branding cost (integer paise, editable until dispatch); the quote line's
  sale value is seeded on convert, so the board shows per-item margin and an order-level
  sale / cost / margin rollup (also surfaced as a Margin column on the gifting pipeline).
  Routing/invoicing of branding cost remains a later concern.
- **Multi-round sample UI** — show the full reject/re-sample history, not just the latest round?
- **Vendor PO** — promote the Phase-1 vendor dropdown to the real procurement/GRN flow?
- **Client portal** — expand the single approval page into an order-level client view?
- **Notifications** — auto-notify the client when a sample is sent, and ops when a decision lands?
