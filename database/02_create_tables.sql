USE authorization_portal;

-- ---------------------------------------------------------------------------
-- Roles: master list of workflow roles. Values match frontend/src/data/users.js
-- (DEMO_USERS / ROLE_DISPLAY_NAME) exactly.
-- ---------------------------------------------------------------------------
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_code VARCHAR(30) NOT NULL UNIQUE,
    role_name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Users: every portal user, one fixed role each (via roles.id).
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(20) NOT NULL UNIQUE,
    employee_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    department VARCHAR(100),
    designation VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- ---------------------------------------------------------------------------
-- Authorization requests (AL / POA). `status` holds the current workflow
-- stage and `return_stage` records which bucket a Send Back should resubmit
-- back into - both use the exact STAGE values from
-- frontend/src/data/workflow.js so the two layers stay in sync.
-- ---------------------------------------------------------------------------
CREATE TABLE authorization_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_number VARCHAR(20) NOT NULL UNIQUE,
    requested_by VARCHAR(20) NOT NULL,
    letter_type VARCHAR(100) NOT NULL,
    requested_for ENUM('Self', 'Others', 'Third Party') NOT NULL DEFAULT 'Self',
    requested_for_employee_id VARCHAR(20),
    department VARCHAR(100),
    designation VARCHAR(100),
    vendor_name VARCHAR(150),
    third_party_id VARCHAR(50),
    initiate_date DATE NOT NULL,
    expiry_date DATE,
    purpose TEXT,
    remark TEXT,
    letter_reference VARCHAR(100),
    status ENUM(
        'HOD_INITIAL', 'ORMD_REVIEW', 'REQUESTER_REVISION', 'COO_ED_REVIEW',
        'SECRETARIAL', 'LETTER_ISSUED', 'REJECTED', 'WITHDRAWN', 'REVOKED'
    ) NOT NULL DEFAULT 'HOD_INITIAL',
    return_stage ENUM('HOD_INITIAL', 'ORMD_REVIEW', 'COO_ED_REVIEW', 'SECRETARIAL') DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (requested_by) REFERENCES users(employee_id)
);

-- ---------------------------------------------------------------------------
-- Per-request approver selection: the Maker picks one approver for each
-- bucket when raising the request (see the "Select Approvers" section of
-- frontend/src/pages/Request/Request.jsx).
-- ---------------------------------------------------------------------------
CREATE TABLE request_approvers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    stage ENUM('HOD_INITIAL', 'ORMD_REVIEW', 'COO_ED_REVIEW', 'SECRETARIAL') NOT NULL,
    approver_employee_id VARCHAR(20) NOT NULL,
    UNIQUE (request_id, stage),
    FOREIGN KEY (request_id) REFERENCES authorization_requests(id),
    FOREIGN KEY (approver_employee_id) REFERENCES users(employee_id)
);

-- ---------------------------------------------------------------------------
-- Supporting documents: KYC / due diligence captured at request time, the
-- Secretarial upload, and the final issued AL/POA letter. File content is
-- stored inline as base64 (file_data) rather than on disk.
-- ---------------------------------------------------------------------------
CREATE TABLE request_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    document_type ENUM('KYC', 'DUE_DILIGENCE', 'SECRETARIAL', 'FINAL_LETTER') NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    file_data LONGTEXT NOT NULL,
    uploaded_by VARCHAR(20),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES authorization_requests(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(employee_id)
);

-- ---------------------------------------------------------------------------
-- Audit logs: the complete, immutable journey of a request from submission
-- to close-out. Send Back / Resubmission append new rows and never overwrite
-- history (workflow spec section 14). `actor_role` is a point-in-time
-- snapshot (not a FK to roles) so the log stays accurate even if an
-- employee's role changes later. Mirrors each entry's shape in
-- RequestsContext.jsx's `audit` array.
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    actor_employee_id VARCHAR(20),
    actor_role VARCHAR(30) NOT NULL,
    action VARCHAR(50) NOT NULL,
    from_stage VARCHAR(30),
    to_stage VARCHAR(30),
    remark TEXT,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES authorization_requests(id),
    FOREIGN KEY (actor_employee_id) REFERENCES users(employee_id)
);

-- ---------------------------------------------------------------------------
-- Notifications generated at every workflow transition (workflow spec
-- section 14).
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    recipient_employee_id VARCHAR(20) NOT NULL,
    stage VARCHAR(30),
    action VARCHAR(50),
    message TEXT,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES authorization_requests(id),
    FOREIGN KEY (recipient_employee_id) REFERENCES users(employee_id)
);

-- ---------------------------------------------------------------------------
-- Request revocation: its own workflow attached to an already-issued request
-- (HOD initiates -> Secretarial approves -> ORMD Head gives final approval).
-- Fields already held on authorization_requests are not duplicated here; only
-- what the HOD types on the revocation screen is stored. Which of these
-- columns and documents are mandatory depends on reason_code - see
-- backend/utils/revocationEngine.js.
-- ---------------------------------------------------------------------------
CREATE TABLE request_revocations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    revocation_number VARCHAR(20) NOT NULL UNIQUE,
    request_id INT NOT NULL,
    initiated_by VARCHAR(20) NOT NULL,
    reason_code VARCHAR(60) NOT NULL,
    reason_text TEXT,
    date_of_revocation DATE NULL,
    letter_lost_date DATE NULL,
    location VARCHAR(150) NULL,
    original_submission_confirmation VARCHAR(30) NULL,
    loss_action_taken TEXT NULL,
    status ENUM('SECRETARIAL_REVIEW', 'ORMD_FINAL', 'REVOKED', 'REJECTED')
        NOT NULL DEFAULT 'SECRETARIAL_REVIEW',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES authorization_requests(id),
    FOREIGN KEY (initiated_by) REFERENCES users(employee_id)
);

CREATE TABLE revocation_approvers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    revocation_id INT NOT NULL,
    stage ENUM('SECRETARIAL_REVIEW', 'ORMD_FINAL') NOT NULL,
    approver_employee_id VARCHAR(20) NOT NULL,
    UNIQUE (revocation_id, stage),
    FOREIGN KEY (revocation_id) REFERENCES request_revocations(id),
    FOREIGN KEY (approver_employee_id) REFERENCES users(employee_id)
);

CREATE TABLE revocation_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    revocation_id INT NOT NULL,
    document_type ENUM('SUPPORTING', 'FIR_REPORT', 'ADVERTISEMENT_CLIPPINGS') NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    file_data LONGTEXT NOT NULL,
    uploaded_by VARCHAR(20),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (revocation_id) REFERENCES request_revocations(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(employee_id)
);

CREATE TABLE revocation_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    revocation_id INT NOT NULL,
    actor_employee_id VARCHAR(20),
    actor_role VARCHAR(30) NOT NULL,
    action VARCHAR(50) NOT NULL,
    from_stage VARCHAR(30),
    to_stage VARCHAR(30),
    remark TEXT,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (revocation_id) REFERENCES request_revocations(id),
    FOREIGN KEY (actor_employee_id) REFERENCES users(employee_id)
);

-- ---------------------------------------------------------------------------
-- Login history: every login attempt (success or failure), plus logout time
-- for successful sessions. `employee_id` intentionally has no FK constraint -
-- a failed attempt with a mistyped/unknown ID must still be recorded for
-- security review.
-- ---------------------------------------------------------------------------
CREATE TABLE login_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(20) NOT NULL,
    login_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    status ENUM('SUCCESS', 'FAILED') NOT NULL,
    failure_reason VARCHAR(255)
);
