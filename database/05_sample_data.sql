USE authorization_portal;

-- Sample request (requires the employee seeded by backend/scripts/createUser.js: employee_id 'EMP0001')
INSERT INTO authorization_requests
    (request_number, requested_by, letter_type, requested_for, department, designation, status, initiate_date, expiry_date, purpose, remark)
VALUES
    ('REQ-00001', 'EMP0001', 'Authorization Letter', 'Self', 'IT', 'Manager', 'HOD_INITIAL', '2026-08-24', '2026-12-31', 'KYC Verification for onboarding.', NULL);

-- Matching "Request Submitted" audit entry (audit rows are append-only, see audit_logs)
INSERT INTO audit_logs (request_id, actor_employee_id, actor_role, action, from_stage, to_stage, remark)
VALUES (LAST_INSERT_ID(), 'EMP0001', 'Requester', 'Request Submitted', NULL, 'HOD_INITIAL', NULL);
