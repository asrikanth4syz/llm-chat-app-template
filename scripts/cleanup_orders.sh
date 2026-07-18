#!/usr/bin/env bash
# ============================================================================
# Resilient one-off ORDER CLEANUP — deletes 8 orders + all workflow rows.
#
# Runs each statement independently so a table that isn't present in this
# database (this app self-heals its schema, so tables can drift) is skipped
# with a warning instead of halting the whole cleanup. Stops on any real error.
#
# ⚠️  IRREVERSIBLE. Back up first:
#     npx wrangler d1 export smart-pantry-db --remote --output backup_before_cleanup.sql
#
# Usage:
#     bash scripts/cleanup_orders.sh            # rehearse on LOCAL dev DB
#     bash scripts/cleanup_orders.sh --remote   # run on PRODUCTION D1
# ============================================================================
set -uo pipefail

DB="smart-pantry-db"
REMOTE="${1:-}"   # pass --remote for production; empty = local
IDS="'SP-2607-3170','SP-2606-3795','SP-2606-5234','SP-2606-5603','SP-2606-3464','SP-2606-6069','SP-2406-0891','SP-2406-0888'"
DC_SUB="SELECT id FROM delivery_challans WHERE order_id IN ($IDS)"

run() {
  local label="$1" sql="$2" out
  out=$(npx wrangler d1 execute "$DB" $REMOTE --command "$sql" 2>&1)
  if echo "$out" | grep -qiE "no such table"; then
    echo "  ↳ skipped (table not present): $label"
  elif echo "$out" | grep -qiE "\berror\b|SQLITE_"; then
    echo "  ✘ ERROR on $label:"; echo "$out" | tail -6; exit 1
  else
    echo "  ✓ $label"
  fi
}

echo "Cleaning up 8 orders on '$DB' ${REMOTE:-(local)} ..."

# 1) delivery-challan children (before the challans themselves)
run "dc_items"         "DELETE FROM dc_items         WHERE dc_id IN ($DC_SUB)"
run "dc_documents"     "DELETE FROM dc_documents     WHERE dc_id IN ($DC_SUB)"
run "delivery_returns" "DELETE FROM delivery_returns WHERE dc_id IN ($DC_SUB)"
run "returns (by dc)"  "DELETE FROM returns          WHERE dc_id IN ($DC_SUB)"

# 2) the delivery challans
run "delivery_challans" "DELETE FROM delivery_challans WHERE order_id IN ($IDS)"

# 3) remaining order-linked rows
run "returns (by order)"     "DELETE FROM returns               WHERE order_id IN ($IDS)"
run "order_items"            "DELETE FROM order_items           WHERE order_id IN ($IDS)"
run "order_history"          "DELETE FROM order_history         WHERE order_id IN ($IDS)"
run "order_comments"         "DELETE FROM order_comments        WHERE order_id IN ($IDS)"
run "order_allocations"      "DELETE FROM order_allocations     WHERE order_id IN ($IDS)"
run "dunning_events"         "DELETE FROM dunning_events        WHERE order_id IN ($IDS)"
run "standing_order_events"  "DELETE FROM standing_order_events WHERE order_id IN ($IDS)"

# 4) preserve vendor POs, just unlink them from the deleted orders
run "purchase_orders (unlink)" "UPDATE purchase_orders SET order_id = NULL WHERE order_id IN ($IDS)"

# 5) the orders themselves
run "orders" "DELETE FROM orders WHERE id IN ($IDS)"

echo "Done. Verify with: npx wrangler d1 execute $DB $REMOTE --command \"SELECT id FROM orders WHERE id IN ($IDS)\" (expect 0 rows)"
