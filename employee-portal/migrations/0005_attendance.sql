-- FR-02 Attendance — biometric import, daily records, and corrections.
-- Links portal employees to their biometric Empcode, stores per-day punches/hours
-- imported from the attendance system, and holds correction/regularisation requests
-- (an approved correction writes back to the day).

ALTER TABLE employees ADD COLUMN attendance_code TEXT; -- biometric Empcode (e.g. 0002)
CREATE INDEX IF NOT EXISTS idx_emp_attcode ON employees(attendance_code);

CREATE TABLE IF NOT EXISTS attendance_days (
  id           TEXT PRIMARY KEY,
  employee_id  TEXT NOT NULL,
  date         TEXT NOT NULL,          -- YYYY-MM-DD
  in_time      TEXT,                   -- HH:MM or NULL
  out_time     TEXT,
  work_minutes INTEGER NOT NULL DEFAULT 0,
  ot_minutes   INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT '',  -- P | A | WO | HL | LV (from the biometric system)
  source       TEXT NOT NULL DEFAULT 'biometric', -- biometric | manual (a correction)
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_att_emp_date ON attendance_days(employee_id, date);

CREATE TABLE IF NOT EXISTS attendance_corrections (
  id               TEXT PRIMARY KEY,
  employee_id      TEXT NOT NULL,
  date             TEXT NOT NULL,
  type             TEXT NOT NULL,       -- regularisation | on_duty | client_visit | wfh
  requested_in     TEXT,
  requested_out    TEXT,
  reason           TEXT,
  status           TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  approver_id      TEXT,
  decision_comment TEXT,
  decided_at       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attcorr_emp ON attendance_corrections(employee_id);
CREATE INDEX IF NOT EXISTS idx_attcorr_status ON attendance_corrections(status);

-- Demo mapping so the attached November report populates the seed employees. The
-- real Empcode to employee mapping is maintained by HR per person.
UPDATE employees SET attendance_code = '0001' WHERE id = 'e_hr';
UPDATE employees SET attendance_code = '0003' WHERE id = 'e_meera';
UPDATE employees SET attendance_code = '0002' WHERE id = 'e_asha';
UPDATE employees SET attendance_code = '0007' WHERE id = 'e_bala';
