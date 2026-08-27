const db = require("../config/db");

const { ROLE_LABELS } = require("../utils/workflowEngine");

const {
    REVOCATION_STAGE,
    REVOCATION_STAGE_ROLE,
    REVOCATION_APPROVER_KEY_TO_STAGE,
    REVOCATION_ACTION_LABELS,
    getReason,
    validateRevocationPayload,
    computeRevocationTransition
} = require("../utils/revocationEngine");


const STAGE_TO_APPROVER_KEY = Object.fromEntries(
    Object.entries(REVOCATION_APPROVER_KEY_TO_STAGE).map(([key, stage]) => [stage, key])
);


function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}


function parseDataUrl(value) {

    if (!value) {
        return { mimeType: null, base64: null };
    }

    const match = /^data:([^;]+);base64,(.+)$/.exec(value);

    if (match) {
        return { mimeType: match[1], base64: match[2] };
    }

    return { mimeType: null, base64: value };

}


// ---------------------------------------------------------------------------
// Row -> frontend shape
// ---------------------------------------------------------------------------

async function attachRelations(rows) {

    if (rows.length === 0) {
        return [];
    }

    const ids = rows.map((row) => row.id);

    const [approverRows] = await db.query(
        `SELECT revocation_id, stage, approver_employee_id FROM revocation_approvers WHERE revocation_id IN (?)`,
        [ids]
    );

    const [documentRows] = await db.query(
        `
        SELECT revocation_id, document_type, file_name, mime_type, file_data, uploaded_at
        FROM revocation_documents
        WHERE revocation_id IN (?)
        ORDER BY id ASC
        `,
        [ids]
    );

    const [auditRows] = await db.query(
        `
        SELECT
            a.revocation_id, a.created_at, a.actor_employee_id, u.employee_name AS actor_name,
            a.actor_role, a.action, a.remark, a.note, a.from_stage, a.to_stage
        FROM revocation_audit_logs a
        LEFT JOIN users u ON u.employee_id = a.actor_employee_id
        WHERE a.revocation_id IN (?)
        ORDER BY a.created_at ASC, a.id ASC
        `,
        [ids]
    );

    const approversByRevocation = {};
    for (const row of approverRows) {
        const key = STAGE_TO_APPROVER_KEY[row.stage];
        if (!key) continue;
        (approversByRevocation[row.revocation_id] ||= {})[key] = row.approver_employee_id;
    }

    const documentsByRevocation = {};
    for (const row of documentRows) {
        (documentsByRevocation[row.revocation_id] ||= []).push({
            type: row.document_type,
            fileName: row.file_name,
            uploadedAt: row.uploaded_at,
            data: `data:${row.mime_type || "application/octet-stream"};base64,${row.file_data}`
        });
    }

    const auditByRevocation = {};
    for (const row of auditRows) {
        (auditByRevocation[row.revocation_id] ||= []).push({
            timestamp: row.created_at,
            actor: row.actor_name
                ? `${row.actor_name} (${row.actor_employee_id})`
                : (row.actor_employee_id || "System"),
            role: row.actor_role,
            action: row.action,
            remark: row.remark || "",
            note: row.note || undefined,
            fromStage: row.from_stage,
            toStage: row.to_stage
        });
    }

    return rows.map((row) => ({
        id: row.revocation_number,
        requestId: row.request_number,
        status: row.status,
        reasonCode: row.reason_code,
        reasonText: row.reason_text || "",
        dateOfRevocation: row.date_of_revocation,
        letterLostDate: row.letter_lost_date,
        location: row.location || "",
        originalSubmissionConfirmation: row.original_submission_confirmation || "",
        lossActionTaken: row.loss_action_taken || "",
        initiatedBy: {
            employeeId: row.initiated_by,
            employeeName: row.initiator_name
        },
        // Snapshot of the parent request, so the review screen can show the
        // pre-filled context without a second round trip.
        request: {
            id: row.request_number,
            letterType: row.letter_type,
            requestedFor: row.requested_for,
            department: row.department,
            vendorName: row.vendor_name || "",
            thirdPartyId: row.third_party_id || "",
            initiateDate: row.initiate_date,
            expiryDate: row.expiry_date,
            letterReference: row.letter_reference || "",
            status: row.request_status,
            requestor: {
                employeeId: row.requested_by,
                employeeName: row.requestor_name
            }
        },
        approvers: approversByRevocation[row.id] || {},
        documents: documentsByRevocation[row.id] || [],
        audit: auditByRevocation[row.id] || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }));

}


async function fetchBaseRows(whereClause, values) {

    const [rows] = await db.query(
        `
        SELECT
            rv.*,
            ar.request_number,
            ar.letter_type,
            ar.requested_for,
            ar.department,
            ar.vendor_name,
            ar.third_party_id,
            ar.initiate_date,
            ar.expiry_date,
            ar.letter_reference,
            ar.requested_by,
            ar.status AS request_status,
            u.employee_name AS initiator_name,
            req.employee_name AS requestor_name
        FROM request_revocations rv
        JOIN authorization_requests ar ON ar.id = rv.request_id
        JOIN users u ON u.employee_id = rv.initiated_by
        JOIN users req ON req.employee_id = ar.requested_by
        ${whereClause}
        ORDER BY rv.created_at DESC
        `,
        values
    );

    return rows;

}


async function insertDocument(revocationId, documentType, file, uploadedBy) {

    if (!file?.data) return;

    const { mimeType, base64 } = parseDataUrl(file.data);

    if (!base64) return;

    await db.execute(
        `
        INSERT INTO revocation_documents (revocation_id, document_type, file_name, mime_type, file_data, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [revocationId, documentType, file.fileName || documentType, mimeType, base64, uploadedBy]
    );

}


// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const getRevocations = async (user) => {

    const role = String(user.role || "").toUpperCase();

    let whereClause = "";
    let values = [];

    if (role === "ADMIN") {
        whereClause = "";
    } else {
        // Visible if you raised it, you are an assigned approver on it, or
        // you are the Maker whose request is being revoked.
        whereClause = `
            WHERE rv.initiated_by = ?
               OR ar.requested_by = ?
               OR rv.id IN (
                   SELECT revocation_id FROM revocation_approvers WHERE approver_employee_id = ?
               )
        `;
        values = [user.employeeId, user.employeeId, user.employeeId];
    }

    const rows = await fetchBaseRows(whereClause, values);

    return attachRelations(rows);

};


const getRevocationByNumber = async (revocationNumber) => {

    const rows = await fetchBaseRows("WHERE rv.revocation_number = ?", [revocationNumber]);

    if (rows.length === 0) {
        return null;
    }

    const [full] = await attachRelations(rows);

    return full;

};


// Only the HOD who previously approved a request may revoke it, and only
// while that request sits at LETTER_ISSUED.
const assertCanInitiate = async (request, user) => {

    const role = String(user.role || "").toUpperCase();

    if (role !== "HOD" && role !== "ADMIN") {
        throw httpError(403, "Only a HOD can initiate a revocation.");
    }

    if (request.status !== "LETTER_ISSUED") {
        throw httpError(409, "Only a request whose letter has been issued can be revoked.");
    }

    if (role === "ADMIN") {
        return;
    }

    const [approverRows] = await db.execute(
        `SELECT 1 FROM request_approvers WHERE request_id = ? AND stage = 'HOD_INITIAL' AND approver_employee_id = ? LIMIT 1`,
        [request.id, user.employeeId]
    );

    if (approverRows.length === 0) {
        throw httpError(403, "You can only revoke a request you were the assigned HOD approver for.");
    }

    const [approvalRows] = await db.execute(
        `
        SELECT 1 FROM audit_logs
        WHERE request_id = ? AND actor_employee_id = ? AND from_stage = 'HOD_INITIAL' AND to_stage = 'ORMD_REVIEW'
        LIMIT 1
        `,
        [request.id, user.employeeId]
    );

    if (approvalRows.length === 0) {
        throw httpError(403, "You can only revoke a request you previously approved.");
    }

};


const createRevocation = async (requestNumber, payload, user) => {

    const [requestRows] = await db.execute(
        `SELECT * FROM authorization_requests WHERE request_number = ?`,
        [requestNumber]
    );

    if (requestRows.length === 0) {
        throw httpError(404, "Request not found.");
    }

    const request = requestRows[0];

    await assertCanInitiate(request, user);

    const [openRows] = await db.execute(
        `
        SELECT 1 FROM request_revocations
        WHERE request_id = ? AND status IN ('SECRETARIAL_REVIEW', 'ORMD_FINAL', 'REVOKED')
        LIMIT 1
        `,
        [request.id]
    );

    if (openRows.length > 0) {
        throw httpError(409, "A revocation is already in progress or completed for this request.");
    }

    const reason = getReason(payload?.reasonCode);

    if (!reason) {
        throw httpError(400, "Select a valid revocation reason.");
    }

    if (!reason.appliesTo.includes(request.requested_for)) {
        throw httpError(400, `"${reason.label}" does not apply to a ${request.requested_for} request.`);
    }

    const problems = validateRevocationPayload(reason, payload);

    if (problems.length > 0) {
        throw httpError(400, problems.join(" "));
    }

    const secretarialApprover = payload?.approvers?.secretarial;
    const ormdApprover = payload?.approvers?.ormdHead;

    if (!secretarialApprover || !ormdApprover) {
        throw httpError(400, "Select both the Secretarial and the ORMD Head approver.");
    }

    const [result] = await db.execute(
        `
        INSERT INTO request_revocations
        (
            revocation_number, request_id, initiated_by, reason_code, reason_text,
            date_of_revocation, letter_lost_date, location,
            original_submission_confirmation, loss_action_taken, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SECRETARIAL_REVIEW')
        `,
        [
            `TMP${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            request.id,
            user.employeeId,
            reason.code,
            String(payload.reasonText).trim(),
            payload.dateOfRevocation || null,
            payload.letterLostDate || null,
            payload.location || null,
            payload.originalSubmissionConfirmation || null,
            payload.lossActionTaken || null
        ]
    );

    const revocationId = result.insertId;
    const revocationNumber = `REV-${String(revocationId).padStart(5, "0")}`;

    await db.execute(
        `UPDATE request_revocations SET revocation_number = ? WHERE id = ?`,
        [revocationNumber, revocationId]
    );

    for (const [key, stage] of Object.entries(REVOCATION_APPROVER_KEY_TO_STAGE)) {

        const employeeId = payload.approvers[key];

        if (!employeeId) continue;

        await db.execute(
            `
            INSERT INTO revocation_approvers (revocation_id, stage, approver_employee_id)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE approver_employee_id = VALUES(approver_employee_id)
            `,
            [revocationId, stage, employeeId]
        );

    }

    for (const document of reason.documents) {

        await insertDocument(
            revocationId,
            document.type,
            payload.documents?.[document.type],
            user.employeeId
        );

    }

    await db.execute(
        `
        INSERT INTO revocation_audit_logs
        (revocation_id, actor_employee_id, actor_role, action, from_stage, to_stage, remark, note)
        VALUES (?, ?, 'HOD', ?, NULL, 'SECRETARIAL_REVIEW', ?, ?)
        `,
        [
            revocationId,
            user.employeeId,
            REVOCATION_ACTION_LABELS.INITIATE,
            String(payload.reasonText).trim(),
            `Revocation initiated by HOD: ${reason.label}.`
        ]
    );

    // Mirror the initiation onto the parent request's own trail, so the
    // request history shows a revocation was raised against it.
    await db.execute(
        `
        INSERT INTO audit_logs (request_id, actor_employee_id, actor_role, action, from_stage, to_stage, remark, note)
        VALUES (?, ?, 'HOD', 'Revocation Initiated', ?, ?, ?, ?)
        `,
        [
            request.id,
            user.employeeId,
            request.status,
            request.status,
            String(payload.reasonText).trim(),
            `${revocationNumber} raised: ${reason.label}.`
        ]
    );

    return getRevocationByNumber(revocationNumber);

};


const applyRevocationAction = async (revocationNumber, action, user, remark) => {

    const [rows] = await db.execute(
        `SELECT * FROM request_revocations WHERE revocation_number = ?`,
        [revocationNumber]
    );

    if (rows.length === 0) {
        throw httpError(404, "Revocation not found.");
    }

    const revocation = rows[0];
    const role = String(user.role || "").toUpperCase();

    const requiredRole = REVOCATION_STAGE_ROLE[revocation.status];

    if (!requiredRole) {
        throw httpError(409, "This revocation is already closed.");
    }

    if (role !== "ADMIN") {

        const [approverRows] = await db.execute(
            `SELECT approver_employee_id FROM revocation_approvers WHERE revocation_id = ? AND stage = ?`,
            [revocation.id, revocation.status]
        );

        const assignedApprover = approverRows[0]?.approver_employee_id;

        if (role !== requiredRole || assignedApprover !== user.employeeId) {
            throw httpError(403, "You are not the assigned approver for this revocation's current stage.");
        }

    }

    if (action === "REJECT" && !String(remark || "").trim()) {
        throw httpError(400, "A remark is required to reject a revocation.");
    }

    const { nextStage, note, revokesParent } = computeRevocationTransition(revocation.status, action);

    if (nextStage === revocation.status) {
        throw httpError(409, note);
    }

    await db.execute(
        `UPDATE request_revocations SET status = ?, updated_at = NOW() WHERE id = ?`,
        [nextStage, revocation.id]
    );

    const actorRoleLabel = ROLE_LABELS[role] || role;

    await db.execute(
        `
        INSERT INTO revocation_audit_logs
        (revocation_id, actor_employee_id, actor_role, action, from_stage, to_stage, remark, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            revocation.id,
            user.employeeId,
            actorRoleLabel,
            REVOCATION_ACTION_LABELS[action] || action,
            revocation.status,
            nextStage,
            String(remark || "").trim() || null,
            note
        ]
    );

    if (revokesParent) {

        const [parentRows] = await db.execute(
            `SELECT status FROM authorization_requests WHERE id = ?`,
            [revocation.request_id]
        );

        const parentStatus = parentRows[0]?.status;

        await db.execute(
            `UPDATE authorization_requests SET status = 'REVOKED', updated_at = NOW() WHERE id = ?`,
            [revocation.request_id]
        );

        await db.execute(
            `
            INSERT INTO audit_logs (request_id, actor_employee_id, actor_role, action, from_stage, to_stage, remark, note)
            VALUES (?, ?, ?, 'Revoked', ?, 'REVOKED', ?, ?)
            `,
            [
                revocation.request_id,
                user.employeeId,
                actorRoleLabel,
                parentStatus,
                String(remark || "").trim() || null,
                `${revocationNumber} approved. The AL / POA is revoked.`
            ]
        );

    }

    return getRevocationByNumber(revocationNumber);

};


module.exports = {
    getRevocations,
    getRevocationByNumber,
    createRevocation,
    applyRevocationAction
};
