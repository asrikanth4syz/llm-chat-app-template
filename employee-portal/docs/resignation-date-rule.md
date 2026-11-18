# Resignation date rule — admin-configurable (single source of truth)

**Status:** Final design (2026-11-18). The rule is no longer hardcoded in one direction — it is an
**admin setting** read at runtime by both the UI and the backend from `portal_config`. Do not
hardcode either direction anywhere; change behaviour by changing the setting, not the code.

## The setting (Admin only — super_admin / HR Admin)
Configured on the **Lifecycle → Resignation date policy** card; stored in `portal_config`:

| Key | Meaning | Default |
|---|---|---|
| `resign_allow_future` | `0` = OFF (past), `1` = ON (today/future) | `1` (ON) — set by migration `0027` |
| `resign_max_future_days` | upper bound in days when ON (1–365) | `90` |

> Default note: migration `0026` seeded this OFF per the original spec; migration `0027` flipped the
> live default to **ON** (today/future) at the product owner's request, so employees pick today or a
> later date and past dates are greyed. Admins can switch back to OFF on the policy card.

Every change requires a **mandatory reason** and is audited (`CONFIG_RESIGN_DATE`: previous → new
values, admin user, timestamp, reason).

## Behaviour by mode
| | OFF (default) | ON |
|---|---|---|
| Default date | Yesterday | Today |
| Allowed | Yesterday or earlier | Today … today + `max_future_days` |
| Blocked | Today and future | Before today; beyond the maximum |
| Picker | `max = yesterday` (later dates disabled) | `min = today`, `max = today+N` (earlier/beyond disabled) |
| Message | `Resignation date must be yesterday or an earlier date.` | `Resignation date cannot be earlier than today.` / `Resignation date cannot be more than {N} days from today.` |

## Time zone & type
- "Today"/"yesterday" are computed **on the server in Asia/Kolkata (IST)**, never from the device
  clock. Date is **date-only** (`YYYY-MM-DD`).
- **Submission timestamp** is a separate, system-generated, read-only field (`created_at`).
- The mode active at submission is stored on the record (`resignations.date_mode`).

## Enforcement (all three layers read the same setting)
1. **UI** (`public/app.js`, `loadResignCard`): picker `min`/`max`/`default` and the client
   re-check come from `GET /api/lifecycle/date-policy`.
2. **Submit-time:** the form re-validates against the policy on submit (covers a form left open
   across a setting change — the employee is asked to pick a new date; nothing is changed silently).
3. **Server** (`src/index.ts`, `handleResignSubmit` → `resignDateMode` + `validateResignDate`):
   authoritative, independent of the picker (covers edited payloads, API calls, imports).

## When the setting changes
- Applies to **new submissions** and to **drafts at submit time** (re-validated under the current
  mode). **Submitted resignations are never modified or re-validated.**
- Existing records that conflict are **listed for review, never altered**:
  `GET /api/admin/lifecycle/legacy-dates` (read-only).

## Related
- Notice period default **60** calendar days (`resign_notice_default_days`); Expected LWD =
  resignation date + notice, recalculated when the date changes.
- Not yet implemented: per-legal-entity / per-location override (global toggle only).
