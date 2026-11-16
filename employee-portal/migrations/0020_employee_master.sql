-- Employee master — full data collection (blueprint §B) + attendance policy rounding-out.
-- Personal, employment, lifecycle and contract fields so HR can maintain a complete record.
-- (personal_email/phone/address/emergency_contact exist from 0003; joining/exit from 0014.)

ALTER TABLE employees ADD COLUMN employee_code TEXT;      -- business-facing code (4S001…)
ALTER TABLE employees ADD COLUMN first_name TEXT;
ALTER TABLE employees ADD COLUMN last_name TEXT;
ALTER TABLE employees ADD COLUMN dob TEXT;                -- YYYY-MM-DD
ALTER TABLE employees ADD COLUMN gender TEXT;             -- stored only where provided
ALTER TABLE employees ADD COLUMN department TEXT;
ALTER TABLE employees ADD COLUMN employment_type TEXT;    -- Permanent|Contract|Outsourced|Intern|Fixed-term
ALTER TABLE employees ADD COLUMN employment_status TEXT NOT NULL DEFAULT 'active'; -- active|probation|notice|suspended|exited
ALTER TABLE employees ADD COLUMN probation_start TEXT;
ALTER TABLE employees ADD COLUMN probation_end TEXT;
ALTER TABLE employees ADD COLUMN confirmed_on TEXT;
ALTER TABLE employees ADD COLUMN contract_start TEXT;
ALTER TABLE employees ADD COLUMN contract_end TEXT;
ALTER TABLE employees ADD COLUMN exit_reason TEXT;
ALTER TABLE employees ADD COLUMN exit_status TEXT;
CREATE INDEX IF NOT EXISTS idx_emp_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_emp_status ON employees(employment_status);

-- Round out the attendance policy so the UI banner matches the configured rules.
ALTER TABLE attendance_policy ADD COLUMN reporting_time TEXT NOT NULL DEFAULT '09:30';
ALTER TABLE attendance_policy ADD COLUMN grace_minutes INTEGER NOT NULL DEFAULT 10;

-- Backfill the demo employees so the master looks complete.
UPDATE employees SET employee_code = '4S001', first_name = 'Nita', last_name = 'Rao', department = 'Human Resources', employment_type = 'Permanent' WHERE id = 'e_hr' AND employee_code IS NULL;
UPDATE employees SET employee_code = '4S002', first_name = 'Meera', last_name = 'Iyer', department = 'Operations', employment_type = 'Permanent' WHERE id = 'e_meera' AND employee_code IS NULL;
UPDATE employees SET employee_code = '4S003', first_name = 'Asha', last_name = 'Kumar', department = 'Operations', employment_type = 'Permanent' WHERE id = 'e_asha' AND employee_code IS NULL;
UPDATE employees SET employee_code = '4S004', first_name = 'Bala', last_name = 'Singh', department = 'Client Services', employment_type = 'Contract' WHERE id = 'e_bala' AND employee_code IS NULL;
