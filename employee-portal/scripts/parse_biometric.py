#!/usr/bin/env python3
"""Convert a biometric "monthly performance" .xls report into the Employee Portal
attendance import payload (FR-02).

The report is a stack of 10-row blocks, one per employee:
  row+0  header (company, "Report Month  <Month>-<YYYY>")
  row+1  Empcode <code> ... Name <name> ... summary totals
  row+2  day numbers 1..31
  row+3  weekday names
  row+4  IN  per-day in-times  (--:-- when none)
  row+5  OUT per-day out-times
  row+6  WORK per-day worked hours (HH:MM)
  row+7  Break
  row+8  OT per-day overtime (HH:MM)
  row+9  Status per-day (P | A | WO | HL | LV)

Usage:
  python3 parse_biometric.py report.xls > import.json
  # then POST it (admin token):
  curl -s $URL/api/admin/attendance/import -H "Authorization: Bearer $TOKEN" \
       -H 'content-type: application/json' --data-binary @import.json

Requires: xlrd  (pip install xlrd).  Reads .xls only (the biometric export format).
"""
import sys, re, json, calendar

try:
    import xlrd
except ImportError:
    sys.exit("xlrd is required: pip install xlrd")

MONTHS = {m.lower(): i for i, m in enumerate(
    ["", "January", "February", "March", "April", "May", "June",
     "July", "August", "September", "October", "November", "December"])}
MONTH_RE = re.compile(r"([A-Za-z]+)[-\s]+(\d{4})")


def norm_time(v):
    s = str(v).strip()
    return None if s in ("", "--:--", "-") else s


def hhmm_to_min(v):
    s = str(v).strip()
    m = re.match(r"^(\d{1,2}):(\d{2})$", s)
    return int(m.group(1)) * 60 + int(m.group(2)) if m else 0


def norm_code(v):
    if isinstance(v, float):
        return str(int(v)).zfill(4)
    return str(v).strip()


def find_month(sheet, row):
    for c in range(sheet.ncols):
        m = MONTH_RE.search(str(sheet.cell_value(row, c)))
        if m and m.group(1).lower() in MONTHS:
            return int(m.group(2)), MONTHS[m.group(1).lower()]
    return None


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: parse_biometric.py <report.xls>")
    sh = xlrd.open_workbook(sys.argv[1]).sheet_by_index(0)
    rows, month_label, skipped = [], None, 0
    for b in range(0, sh.nrows, 10):
        if b + 9 >= sh.nrows:
            break
        code = norm_code(sh.cell_value(b + 1, 2))
        if not code or code.lower() in ("empcode", "0", "0000"):
            skipped += 1
            continue
        ym = find_month(sh, b)
        if not ym:
            skipped += 1
            continue
        year, mon = ym
        month_label = f"{year:04d}-{mon:02d}"
        ndays = calendar.monthrange(year, mon)[1]
        for d in range(1, ndays + 1):
            col = d  # col 0 is the row label; day d sits in column d
            date = f"{year:04d}-{mon:02d}-{d:02d}"
            rows.append({
                "code": code,
                "date": date,
                "in": norm_time(sh.cell_value(b + 4, col)),
                "out": norm_time(sh.cell_value(b + 5, col)),
                "workMinutes": hhmm_to_min(sh.cell_value(b + 6, col)),
                "otMinutes": hhmm_to_min(sh.cell_value(b + 8, col)),
                "status": str(sh.cell_value(b + 9, col)).strip(),
            })
    sys.stderr.write(f"parsed {len(rows)} day-rows for month {month_label} ({skipped} blocks skipped)\n")
    json.dump({"month": month_label, "rows": rows}, sys.stdout)


if __name__ == "__main__":
    main()
