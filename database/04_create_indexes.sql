USE authorization_portal;

-- Indexes for commonly queried columns
-- (users.employee_id/email, roles.role_code, and request_approvers'
-- unique pair are already indexed via UNIQUE)
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_requests_requested_by ON authorization_requests(requested_by);
CREATE INDEX idx_requests_status ON authorization_requests(status);
CREATE INDEX idx_request_approvers_approver ON request_approvers(approver_employee_id);
CREATE INDEX idx_request_documents_request_id ON request_documents(request_id);
CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_employee_id, is_read);
CREATE INDEX idx_login_history_employee_id ON login_history(employee_id);
CREATE INDEX idx_login_history_login_time ON login_history(login_time);
CREATE INDEX idx_revocations_request_id ON request_revocations(request_id);
CREATE INDEX idx_revocations_status ON request_revocations(status);
CREATE INDEX idx_revocations_initiated_by ON request_revocations(initiated_by);
CREATE INDEX idx_revocation_approvers_approver ON revocation_approvers(approver_employee_id);
CREATE INDEX idx_revocation_documents_revocation_id ON revocation_documents(revocation_id);
CREATE INDEX idx_revocation_audit_revocation_id ON revocation_audit_logs(revocation_id);
