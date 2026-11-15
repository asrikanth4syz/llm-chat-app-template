-- Dev seed: a Finance Admin (payroll maker) and a Finance Approver (payroll checker) so the
-- maker-checker flow is demonstrable — separation of duties needs two distinct users.
-- Rotate/disable before go-live, like the other seed logins.
INSERT OR IGNORE INTO users (id, realm, email, phone, password_hash, role, employee_id, active, lang) VALUES
  ('u_finmaker', 'employee-portal', 'finmaker@4syz.com', NULL, 'SEED:pw123', 'finance_admin',    NULL, 1, 'en'),
  ('u_fincheck', 'employee-portal', 'fincheck@4syz.com', NULL, 'SEED:pw123', 'finance_approver', NULL, 1, 'en');
