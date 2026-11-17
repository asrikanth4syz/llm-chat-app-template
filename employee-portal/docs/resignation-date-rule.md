# Resignation date rule — LOCKED

**Status:** Final (2026-11-17). This rule has flip-flopped during development; treat this file as
the single source of truth. Do not change the direction without updating this note and the three
enforcement layers below together.

## The rule
- **Default:** yesterday (IST).
- **Allowed:** yesterday or any earlier date.
- **Blocked:** today and any future date.
- **Message (verbatim):** `Resignation date must be yesterday or an earlier date.`

## Why
A resignation records a date that has already occurred (the day it was tendered/effective); it is
never post-dated into the future, and "today" is excluded so the submission day itself cannot be
backfilled as the resignation date.

## Time zone & type
- "Today"/"yesterday" are computed **on the server in Asia/Kolkata (IST, UTC+05:30)**, never from
  the device clock.
- Resignation date is a **date-only** value (`YYYY-MM-DD`); no time component, to avoid UTC/IST
  off-by-one errors.
- The **submission timestamp** is a separate, system-generated, read-only field (`created_at`).

## Enforcement (all three layers — keep in sync)
1. **UI** (`public/app.js`, `loadResignCard` tender form): date input `value = yesterday`,
   `max = yesterday`.
2. **Submit-time** (same handler): re-check `date >= today` before calling the API; show the
   localized message (`dateYestOrEarlier`).
3. **Server** (`src/index.ts`, `handleResignSubmit`): compute IST `today`; reject when
   `resignationDate >= today` with the verbatim message. This is authoritative and independent of
   the picker (covers edited payloads, direct API calls, imports).

## Related
- Default **notice period = 60** calendar days (config `resign_notice_default_days`); Expected LWD
  = resignation date + notice, recalculated when the date changes.
- Existing records are never auto-modified. Use `GET /api/admin/lifecycle/legacy-dates` (read-only)
  to list any resignations whose date is today/future for manual review.
