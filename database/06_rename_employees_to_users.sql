USE authorization_portal;

-- Run once against databases created before the table was renamed.
RENAME TABLE employees TO users;
ALTER TABLE users RENAME INDEX idx_employees_role_id TO idx_users_role_id;

ALTER TABLE authorization_requests
	ADD COLUMN letter_reference VARCHAR(100) NULL AFTER remark;