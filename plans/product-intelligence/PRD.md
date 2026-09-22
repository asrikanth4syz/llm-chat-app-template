# Product Intelligence & Brand Catalogue — PRD (v1 draft)

Status: **Draft for review** · Source spec: `4SYZ_Product_Intelligence_Feature_Specification_v1.docx` · Target app: `llm-chat-app-template` worker (Smart Pantry)

> This PRD distils the 26‑section 4SYZ spec into an implementation‑ready plan **mapped to the existing Smart Pantry codebase**. It is a planning artifact only — no feature code is built yet. A companion visual **mock** accompanies this PRD.

## 0. Decisions locked (v1.1)
1. **OCR / AI = own, in‑platform** (no third‑party SaaS; product data never leaves 4SYZ infra). Implementation: **Cloudflare Workers AI** vision/OCR model *or* **Tesseract (WASM)** behind one `extractProductDoc()` seam. Building an OCR engine from scratch is explicitly out of scope. **MVP ships with manual entry + document upload**; in‑platform OCR is wired in P0.2. A slow/large extract runs off the request path (queue or `waitUntil`).
2. **Verification is done by `ops_admin`** — no new `product_verifier` role. Client roles never see internal verification screens.
3. **Collections are rule‑driven** — a saved rule (`rule_json`, e.g. `attributes⊇[vegan] AND verified=true AND price≤X`) materialises the member list; the collection is labelled *rule‑driven* (with optional editorial pin/exclude later). No hand‑curated MVP.
4. **Attributes = a projection of verified claims** (single source of truth). Certification evidence is **sourced against Indian FSSAI** first: store FSSAI **licence/registration number**, validity dates and the certificate doc; verification checks the number/expiry. Other certs (ISO, HACCP, Organic) are additional, but FSSAI is the primary Indian regulator hook.

---

## 1. Problem & goal
Corporate clients pick pantry/workplace consumables today from a flat catalogue with price + GST only. They can't discover by dietary/ingredient needs, can't trust marketing claims, and can't compare products. **Goal:** add a trusted product‑intelligence layer — rich product facts, **AI‑assisted** claim extraction/screening, **human‑verified** badges, advanced filters, comparison and curated collections — without turning AI screening into a compliance decision.

## 2. Non‑negotiable principles (from spec §2, §26)
1. **AI assists, humans decide.** AI extracts + screens; only a 4SYZ reviewer publishes a "4SYZ Verified" claim.
2. **Every published claim carries evidence** (source doc + page + extraction date + reviewer).
3. **Commercial data (client price, MOQ, lead time, cost) stays separate** from public product facts and role‑gated.
4. **No regulatory/medical framing.** Attributes are "verified product attributes", never certifications of compliance.
5. **No silent overwrite** of verified data — versioned, audited.

These map to hard acceptance criteria in §9 below.

## 3. What already exists (reuse, don't rebuild)
| Spec need | Already in codebase | Reuse |
|---|---|---|
| Product identity/price | `inventory` (sku, name, category, brand, subcategory, unit_price=list, mrp, cost_excl_gst, gst_rate, hsn_code, uom, stock, vendor_id, emoji) | Extend, don't replace |
| Per‑client price | `client_catalog` → `client_price` + `ccLadderRow` ladder UI (MRP→List→Client→Discount→GST→Landed→Margin) | Product‑detail "Pricing & Availability" tab reuses this maths (`_cclCompute`) |
| Vendor sourcing | `vendors` (lead_days, on_time, fill, rating, preferred/backup) | "Internal Procurement view" + availability/lead‑time filters |
| Document storage | `docPut`/`docGet` (base64‑in‑D1, R2‑ready) | Evidence/label/certificate uploads |
| Runtime schema self‑heal | `ensureFeatureTables(env)` (CREATE IF NOT EXISTS + idempotent ALTER) | All new tables/columns land here — no migration replay |
| Delegated UI pattern | `dataAct/dataInput/...` + `test/smoke.mjs` (targets must be real globals) | New screens follow it |

## 4. Scope by release (from spec §22 MVP table)
**P0 — Catalogue + Verification core (MVP)**
- Product master enrichment: ingredients, nutrition, dietary/ingredient **attributes**, pack/MOQ.
- Brand profiles (logo, story, origin, status).
- Client catalogue **listing + product detail** (tabs), search, price filters, availability, client price.
- **Claims**: store, AI‑extraction status, AI‑screening status, evidence, **human verification queue**, **4SYZ Verified badge**, audit trail, document upload + expiry.

**P1 — Decision tools**
- Product **comparison** (2–4), dietary/nutrition filters, **curated collections**, internal procurement view, price history, MOQ/lead‑time filters.

**P2 — Advanced AI**
- Contradiction engine, recommendation/personalised discovery, automated document refresh / external verification.

## 5. Data model (new D1 tables — all via `ensureFeatureTables`)
Additive only; nothing in existing tables is dropped.

```
brands(id, name, slug, logo_doc_id, story, origin, website, brand_type,      -- Indian/Global/D2C/Enterprise/Regional
       status, sla_json, created_at, updated_at)                             -- status: draft|review|approved|suspended|archived

inventory  (+ALTER)  brand_id, product_type, barcode_gtin, pack_size, units_per_carton,
                     moq, case_config, serving_info, storage, lifecycle_status
product_content(sku PK, description, usage, images_json, updated_at)
product_nutrition(sku PK, calories, protein, carbs, sugar, fat, fibre, sodium, basis, source_ref)
product_ingredients(id, sku, position, raw_text, normalized_id, group, allergen INT, flags_json)
ingredient_dict(id, canonical_name, synonyms_json, allergen INT, animal_derived INT, category)

product_attributes(id, sku, attribute, value, status, source)               -- attribute e.g. vegan; status = ai_extracted|ai_screened|verified|rejected|expired

claims(id, sku, category, label, status, ai_confidence, screened_result,    -- category per §11 taxonomy
       reviewer_id, reviewed_at, expiry_date, created_at)                    -- status per §13
claim_evidence(id, claim_id, doc_id, page_ref, extracted_text, extraction_date)
claim_history(id, claim_id, action, actor_id, from_status, to_status, note, at)
certifications(id, brand_id|sku, kind, number, issuer, valid_from, valid_to, doc_id, status)

collections(id, name, slug, kind, rule_json, curated_by, published INT)      -- kind: editorial|ai_assisted|verified
collection_items(collection_id, sku)

client_favourites(client_id, sku, created_at)
saved_filters(id, user_id, name, query_json, created_at)
verification_tasks(id, sku|claim_id, type, priority, status, assignee_id, created_at)
```
Cross‑check dictionaries (preservatives, animal‑derived, sweeteners) live as **config rows** so the rule library is editable, per spec §12 ("configurable, reviewed by qualified personnel").

## 6. AI engine (spec §10–§12) — architecture
- **Boundary:** AI is an internal assistant. It writes to `*_status = ai_extracted|ai_screened` and creates `verification_tasks`; it **never** writes `verified`.
- **Extraction:** OCR/label/PDF → ingredients, nutrition, claims, certification numbers, manufacturer. Provider is pluggable (Workers AI or external vision model) behind one `extractProductDoc(doc)` seam, mirroring the existing injectable‑client pattern used for Zoho.
- **Screening rules (§12):** deterministic, config‑driven cross‑checks (e.g. Vegan claim vs animal‑derived dictionary → `potential_conflict`). Output = advisory flag + confidence, always → review queue for anything conflicting/low‑confidence/evidence‑required.
- **Every fact keeps `extracted_text` + source ref** (evidence table) — hard requirement.
- Governance: model output labelled "AI Screened", never "Verified"; no compliance language surfaced client‑side.

## 7. API surface (new routes in `src/index.ts`)
Client/read: `GET /api/catalog/products` (filters+facets), `/products/:sku` (full intelligence), `/brands`, `/brands/:id`, `/collections`, `/collections/:slug`, `POST /api/compare`, `GET/POST /api/favourites`, `GET/POST /api/saved-filters`.
Internal/verify (role‑gated): `GET /api/verification/queue`, `POST /api/claims/:id/{approve|reject|request-evidence|edit|reclassify}`, `POST /api/products/:sku/ai/extract`, `POST /api/products/:sku/ai/screen`, `POST /api/documents` (evidence upload), `GET /api/products/:sku/audit`.
Procurement (role‑gated): `GET /api/procurement/products` (cost, margin, vendors, SLA, doc‑completeness, price history).
All reads return `verification_status` + badge; commercial fields filtered by role (client never sees cost/margin).

## 8. UI / navigation (which module, which role)
Extends the existing sidebar (`app.01`) and reuses the client‑catalogue modal ladder.
- **Client Catalogue** (client roles + super_admin preview): listing (`app.13`/new `app.15-catalog.js`) with filter drawer, product cards (badges/compare/favourite/add‑to‑order), **Product Detail** modal with tabs (Overview · Ingredients · Nutrition · Attributes · Claims & Verification · Certifications · Brand · Pricing & Availability · Documents · Related), **Compare** tray (2–4).
- **Collections / Better Choices** entry in Catalogue nav.
- **Product Verification** (super_admin + new `product_verifier` role): queue, claim review, evidence viewer, AI‑reasoning panel, badge control — a new nav group "Product Intelligence (internal)".
- **Procurement view** additions under existing Vendors/Procurement.
- New roles: `product_verifier` (extends the existing role map in `app.01` + server `requireUser` gates).

## 9. Acceptance criteria (testable — feed vitest)
1. A claim can reach `verified` **only** via a reviewer action; AI endpoints cannot set it (server rejects).
2. Publishing a `verified` claim **requires ≥1 `claim_evidence` row** (except attributes explicitly marked evidence‑not‑applicable).
3. Client responses **never include** cost/margin/vendor fields (role filter enforced server‑side, covered by a test).
4. Editing a verified claim writes a `claim_history` row and bumps a version — **no in‑place silent overwrite**.
5. Screening a Vegan/Dairy‑Free/Egg‑Free claim against a matching animal‑derived ingredient yields `potential_conflict` and a `verification_task`.
6. Expiry: a claim past `expiry_date` renders as **Verification Expired**, not Verified.
7. Filters combine (AND across groups, OR within a group) and return correct facet counts.

## 10. Risks / open questions
Resolved (see §0): AI = own/in‑platform · verifier = `ops_admin` · collections = rule‑driven · attributes = verified‑claim projection · certs sourced against FSSAI.
Still open / to watch:
1. **OCR runtime cost & accuracy** — Workers AI vision vs Tesseract WASM: pick during P0.2 with a small bake‑off on real labels; keep the `extractProductDoc()` seam so the choice is swappable.
2. **Async extraction** — long OCR must not block the request; needs a queue or `ctx.waitUntil` + a task row. Confirm Cloudflare Queues is acceptable (else `waitUntil` for MVP).
3. **Images at scale** — enable the scaffolded **R2 bucket** before bulk product images (base64‑in‑D1 won't scale).
4. **FSSAI validation depth** — MVP stores + expiry‑checks the licence number; live lookup against an FSSAI source is P2 and subject to egress policy.
5. **GST‑incl/excl by role** already exists in the price ladder — reuse as‑is.

## 12. P0 build plan (for sign‑off — not yet built)
Additive, gated (`tsc` · `vitest` · `smoke`), one deploy per slice to the `llm` worker.

| Slice | What ships | Key files |
|---|---|---|
| **P0.0 Schema** | `ensureFeatureTables` adds brands, product_content/nutrition/ingredients, ingredient_dict, product_attributes, claims, claim_evidence, claim_history, certifications (FSSAI fields), collections(+rule_json)/collection_items, verification_tasks, client_favourites, saved_filters. Inventory ALTERs (brand_id, product_type, pack_size, moq, lifecycle_status). No UI. | `src/index.ts` (+ `migrations/00xx_*.sql` for the test DB) |
| **P0.1 Product master + read API** | Super‑admin product enrichment (ingredients/nutrition/attributes/pack/MOQ); `GET /api/catalog/products` (filters+facets) and `/products/:sku`; role filter hides cost/margin. | `src/index.ts`, `public/app.05-billing-inventory.js` |
| **P0.2 Own OCR seam** | `extractProductDoc(doc)` → Workers AI/Tesseract; writes `ai_extracted`/`ai_screened` only, creates `verification_tasks`; runs off request path. Rule‑driven claim screening (config dictionaries: animal‑derived, preservatives, sweeteners). | `src/index.ts` |
| **P0.3 Verification (ops_admin)** | Queue + claim review (approve/reject/request‑evidence/edit/reclassify), evidence viewer, FSSAI cert check, badge control, `claim_history` audit, expiry. Server rejects any AI‑set `verified`. | new `public/app.15-catalog.js`, `app.01` nav, `src/index.ts` |
| **P0.4 Client catalogue** | Listing + filter drawer + product‑detail tabs + badges + add‑to‑order/favourite; reuses price‑ladder maths. (Compare + rule‑driven collections follow in P1.) | `public/app.15-catalog.js` |

Acceptance criteria in §9 become the vitest suite. Estimated as ~5 reviewable slices; each is independently shippable.

## 11. Suggested build sequence (when approved)
1. Schema + `ensureFeatureTables` migrations for brands/content/nutrition/ingredients/attributes/claims/evidence/certifications (no UI).
2. Product master enrichment UI (super_admin) + read API with facets.
3. Client catalogue listing + product detail + filters (P0 client value).
4. Verification queue + claim workflow + badges + audit (P0 trust).
5. AI extraction/screening seam (stub → provider).
6. Comparison + collections + procurement view (P1).
Each step behind the usual gates: `tsc` · `vitest` · `smoke`, one deploy per slice.

---
*Companion:* interactive mock of the Catalogue, Product Detail, Compare and Verification Queue screens.
