USE authorization_portal;

-- Master/lookup data.
INSERT INTO roles (role_code, role_name, description) VALUES
    ('MAKER', 'Maker', 'Raises requests and acts on Sent Back requests.'),
    ('HOD', 'HOD', 'HOD Checker - Initial Review and Second Review buckets.'),
    ('ORMD_HEAD', 'ORMD Head', 'ORMD Head Checker - Approve, Send Back, Reject.'),
    ('COO_ED', 'COO / ED', 'COO/ED Checker - Approve, Send Back, Reject.'),
    ('SECRETARIAL', 'Secretarial', 'Issues the final AL/POA letter only.'),
    ('ADMIN', 'Admin', 'Full system administration, monitoring, reporting and oversight.');

-- Employee rows need a bcrypt password_hash, so seed them via
-- backend/scripts/createUser.js (uses bcrypt.hash) instead of a raw INSERT here.
-- (see frontend/src/data/users.js for the matching demo directory of role_code values).
