USE authorization_portal;

-- ---------------------------------------------------------------------------
-- Request Revocation Flow
--
-- A revocation is its own workflow attached to an already-issued request:
--     HOD initiates -> Secretarial approves -> ORMD Head gives final approval
-- Once ORMD Head approves, the revocation closes and the parent request moves
-- to the new REVOKED status.
--
-- Only the HOD who previously approved the request may initiate its
-- revocation, and only while the request sits at LETTER_ISSUED.
--
-- Run once against databases created before revocation was added.
-- ---------------------------------------------------------------------------


-- A revoked request is a new terminal state on the parent request.
ALTER TABLE authorization_requests
    MODIFY COLUMN status ENUM(
        'HOD_INITIAL', 'ORMD_REVIEW', 'REQUESTER_REVISION', 'COO_ED_REVIEW',
        'SECRETARIAL', 'LETTER_ISSUED', 'REJECTED', 'WITHDRAWN', 'REVOKED'
    ) NOT NULL DEFAULT 'HOD_INITIAL';


-- ---------------------------------------------------------------------------
-- The revocation itself. Fields that already exist on the parent request
-- (letter type, department, issue/expiry dates, AL/POA reference, vendor) are
-- NOT duplicated here - they are read back from authorization_requests so the
-- two can never drift. Only what the HOD actually types on the revocation
-- screen is stored below.
-- ---------------------------------------------------------------------------
CREATE TABLE request_revocations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    revocation_number VARCHAR(20) NOT NULL UNIQUE,
    request_id INT NOT NULL,
    initiated_by VARCHAR(20) NOT NULL,

    -- Which of the six reasons was picked; drives which fields/documents
    -- the screen requires (see backend/utils/revocationEngine.js).
    reason_code VARCHAR(60) NOT NULL,
    reason_text TEXT,

    -- Reason-specific fields, all optional at the column level because each
    -- reason requires a different subset. The engine enforces per-reason rules.
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


-- ---------------------------------------------------------------------------
-- The approver the initiating HOD picks for each revocation stage.
-- ---------------------------------------------------------------------------
CREATE TABLE revocation_approvers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    revocation_id INT NOT NULL,
    stage ENUM('SECRETARIAL_REVIEW', 'ORMD_FINAL') NOT NULL,
    approver_employee_id VARCHAR(20) NOT NULL,
    UNIQUE (revocation_id, stage),
    FOREIGN KEY (revocation_id) REFERENCES request_revocations(id),
    FOREIGN KEY (approver_employee_id) REFERENCES users(employee_id)
);


-- ---------------------------------------------------------------------------
-- Evidence attached to a revocation. Stored inline as base64, matching
-- request_documents.
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
-- Immutable trail for the revocation, mirroring audit_logs.
-- ---------------------------------------------------------------------------
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


CREATE INDEX idx_revocations_request_id ON request_revocations(request_id);
CREATE INDEX idx_revocations_status ON request_revocations(status);
CREATE INDEX idx_revocations_initiated_by ON request_revocations(initiated_by);
CREATE INDEX idx_revocation_approvers_approver ON revocation_approvers(approver_employee_id);
CREATE INDEX idx_revocation_documents_revocation_id ON revocation_documents(revocation_id);
CREATE INDEX idx_revocation_audit_revocation_id ON revocation_audit_logs(revocation_id);
