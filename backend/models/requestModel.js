const db = require("../config/db");

const {
    ACTION_LABELS,
    STAGE_APPROVER_ROLE,
    ROLE_LABELS,
    computeTransition
} = require("../utils/workflowEngine");

const APPROVER_KEY_TO_STAGE = {
    hod: "HOD_INITIAL",
    ormdHead: "ORMD_REVIEW",
    cooEd: "COO_ED_REVIEW",
    secretarial: "SECRETARIAL"
};

const STAGE_TO_APPROVER_KEY = Object.fromEntries(
    Object.entries(APPROVER_KEY_TO_STAGE).map(([key, stage]) => [stage, key])
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
// Relation loading / row -> frontend-shape mapping
// ---------------------------------------------------------------------------

async function attachRelations(rows) {

    if (rows.length === 0) {
        return [];
    }

    const ids = rows.map((row) => row.id);

    const [approverRows] = await db.query(
        `SELECT request_id, stage, approver_employee_id FROM request_approvers WHERE request_id IN (?)`,
        [ids]
    );

    const [documentRows] = await db.query(
        `
        SELECT request_id, document_type, file_name, mime_type, file_data, uploaded_at
        FROM request_documents
        WHERE request_id IN (?)
        ORDER BY FIELD(document_type, 'KYC', 'DUE_DILIGENCE', 'SECRETARIAL', 'FINAL_LETTER')
        `,
        [ids]
    );

    const [auditRows] = await db.query(
        `
        SELECT
            a.request_id, a.created_at, a.actor_employee_id, e.employee_name AS actor_name,
            a.actor_role, a.action, a.remark, a.note, a.from_stage, a.to_stage
        FROM audit_logs a
        LEFT JOIN users e ON e.employee_id = a.actor_employee_id
        WHERE a.request_id IN (?)
        ORDER BY a.created_at ASC, a.id ASC
        `,
        [ids]
    );

    const approversByRequest = {};
    for (const row of approverRows) {
        const key = STAGE_TO_APPROVER_KEY[row.stage];
        if (!key) continue;
        (approversByRequest[row.request_id] ||= {})[key] = row.approver_employee_id;
    }

    const documentsByRequest = {};
    const attachmentsByRequest = {};
    const finalLettersByRequest = {};
    for (const row of documentRows) {
        (documentsByRequest[row.request_id] ||= []).push(row.file_name);
        (attachmentsByRequest[row.request_id] ||= []).push({
            type: row.document_type,
            fileName: row.file_name,
            uploadedAt: row.uploaded_at,
            data: `data:${row.mime_type || "application/octet-stream"};base64,${row.file_data}`
        });
        if (row.document_type === "FINAL_LETTER") {
            finalLettersByRequest[row.request_id] = row;
        }
    }

    const auditByRequest = {};
    for (const row of auditRows) {
        (auditByRequest[row.request_id] ||= []).push({
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
        id: row.request_number,
        requestor: {
            employeeId: row.requested_by,
            employeeName: row.requestor_name,
            department: row.requestor_department,
            designation: row.requestor_designation
        },
        letterType: row.letter_type,
        requestedFor: row.requested_for,
        requestedForEmployeeId: row.requested_for_employee_id || "",
        department: row.department,
        designation: row.designation,
        initiateDate: row.initiate_date,
        expiryDate: row.expiry_date,
        purpose: row.purpose,
        remark: row.remark,
        vendorName: row.vendor_name || "",
        thirdPartyId: row.third_party_id || "",
        documents: documentsByRequest[row.id] || [],
        documentAttachments: attachmentsByRequest[row.id] || [],
        letterReference: row.letter_reference || "",
        letterDocument: finalLettersByRequest[row.id]?.file_name || "",
        letterDocumentData: finalLettersByRequest[row.id]
            ? `data:${finalLettersByRequest[row.id].mime_type || "application/octet-stream"};base64,${finalLettersByRequest[row.id].file_data}`
            : "",
        approvers: approversByRequest[row.id] || {},
        status: row.status,
        returnStage: row.return_stage || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        audit: auditByRequest[row.id] || []
    }));

}

async function fetchBaseRows(whereClause, values) {

    const [rows] = await db.query(
        `
        SELECT
            ar.*,
            e.employee_name AS requestor_name,
            e.department AS requestor_department,
            e.designation AS requestor_designation
        FROM authorization_requests ar
        JOIN users e ON e.employee_id = ar.requested_by
        ${whereClause}
        ORDER BY ar.created_at DESC
        `,
        values
    );

    return rows;

}


// ---------------------------------------------------------------------------
// Approvers / documents helpers
// ---------------------------------------------------------------------------

async function upsertApprovers(requestId, approvers) {

    for (const [key, stage] of Object.entries(APPROVER_KEY_TO_STAGE)) {

        const employeeId = approvers?.[key];

        if (!employeeId) continue;

        await db.execute(
            `
            INSERT INTO request_approvers (request_id, stage, approver_employee_id)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE approver_employee_id = VALUES(approver_employee_id)
            `,
            [requestId, stage, employeeId]
        );

    }

}

async function insertDocument(requestId, documentType, fileName, fileDataUrl, uploadedBy) {

    if (!fileDataUrl) return;

    const { mimeType, base64 } = parseDataUrl(fileDataUrl);

    if (!base64) return;

    await db.execute(
        `
        INSERT INTO request_documents (request_id, document_type, file_name, mime_type, file_data, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [requestId, documentType, fileName || documentType, mimeType, base64, uploadedBy]
    );

}


// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const createRequest = async (data, user) => {

    const [result] = await db.execute(
        `
        INSERT INTO authorization_requests
        (
            request_number, requested_by, letter_type, requested_for, requested_for_employee_id,
            department, designation, vendor_name, third_party_id, status,
            initiate_date, expiry_date, purpose, remark
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'HOD_INITIAL', ?, ?, ?, ?)
        `,
        [
            `T${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            user.employeeId,
            data.letterType,
            data.requestedFor,
            data.requestedForEmployeeId || null,
            data.department,
            data.designation,
            data.vendorName || null,
            data.thirdPartyId || null,
            data.initiateDate,
            data.expiryDate || null,
            data.purpose,
            data.remark || null
        ]
    );

    const requestId = result.insertId;
    const requestNumber = `REQ-${String(requestId).padStart(5, "0")}`;

    await db.execute(
        `UPDATE authorization_requests SET request_number = ? WHERE id = ?`,
        [requestNumber, requestId]
    );

    await upsertApprovers(requestId, data.approvers);

    await insertDocument(requestId, "KYC", data.kycDocument, data.kycDocumentData, user.employeeId);
    await insertDocument(requestId, "DUE_DILIGENCE", data.dueDiligenceDocument, data.dueDiligenceDocumentData, user.employeeId);

    await db.execute(
        `
        INSERT INTO audit_logs (request_id, actor_employee_id, actor_role, action, from_stage, to_stage, remark)
        VALUES (?, ?, 'Requester', 'Request Submitted', NULL, 'HOD_INITIAL', ?)
        `,
        [requestId, user.employeeId, data.remark || null]
    );

    return getRequestById(requestNumber, user);

};

const getRequests = async (user) => {

    const role = String(user.role || "").toUpperCase();

    let whereClause = "";
    let values = [];

    if (role === "ADMIN") {
        whereClause = "";
    } else if (role === "MAKER") {
        whereClause = "WHERE ar.requested_by = ?";
        values = [user.employeeId];
    } else {
        whereClause = `
            WHERE ar.id IN (
                SELECT request_id FROM request_approvers WHERE approver_employee_id = ?
            )
        `;
        values = [user.employeeId];
    }

    const rows = await fetchBaseRows(whereClause, values);

    return attachRelations(rows);

};

const getRequestById = async (requestNumber, user) => {

    const rows = await fetchBaseRows("WHERE ar.request_number = ?", [requestNumber]);

    if (rows.length === 0) {
        return null;
    }

    const row = rows[0];
    const role = String(user.role || "").toUpperCase();

    if (role !== "ADMIN") {

        if (role === "MAKER") {

            if (row.requested_by !== user.employeeId) {
                return null;
            }

        } else {

            const [approverCheck] = await db.execute(
                `SELECT 1 FROM request_approvers WHERE request_id = ? AND approver_employee_id = ? LIMIT 1`,
                [row.id, user.employeeId]
            );

            if (approverCheck.length === 0) {
                return null;
            }

        }

    }

    const [full] = await attachRelations(rows);

    return full;

};

const applyAction = async (requestNumber, action, user, remark, extra) => {

    const [rows] = await db.execute(
        `SELECT * FROM authorization_requests WHERE request_number = ?`,
        [requestNumber]
    );

    if (rows.length === 0) {
        throw httpError(404, "Request not found.");
    }

    const request = rows[0];
    const role = String(user.role || "").toUpperCase();

    if (action === "MAKER_WITHDRAW") {

        if (request.requested_by !== user.employeeId) {
            throw httpError(403, "Only the requester can withdraw this request.");
        }

    } else {

        const requiredRole = STAGE_APPROVER_ROLE[request.status];

        if (!requiredRole) {
            throw httpError(409, "No action is available for this request at its current stage.");
        }

        if (role !== "ADMIN") {

            const [approverRows] = await db.execute(
                `SELECT approver_employee_id FROM request_approvers WHERE request_id = ? AND stage = ?`,
                [request.id, request.status]
            );

            const assignedApprover = approverRows[0]?.approver_employee_id;

            if (role !== requiredRole || assignedApprover !== user.employeeId) {
                throw httpError(403, "You are not the assigned approver for this request's current stage.");
            }

        }

    }

    const { nextStage, note, returnStage } = computeTransition(request.status, action);

    if (nextStage === request.status) {
        throw httpError(409, note);
    }

    if (action === "ISSUE_LETTER") {
        if (!extra?.letterReference?.trim()) {
            throw httpError(400, "A letter reference is required before issuing the letter.");
        }

        if (!extra?.letterDocumentData) {
            throw httpError(400, "The issued letter document is required before issuing the letter.");
        }
    }

    await db.execute(
        `UPDATE authorization_requests SET status = ?, return_stage = ?, letter_reference = ?, updated_at = NOW() WHERE id = ?`,
        [
            nextStage,
            returnStage !== undefined ? returnStage : request.return_stage,
            action === "ISSUE_LETTER" ? extra.letterReference.trim() : request.letter_reference,
            request.id
        ]
    );

    let auditRemark = remark || null;

    if (action === "ISSUE_LETTER" && extra) {

        if (extra.letterDocumentData) {
            await insertDocument(request.id, "FINAL_LETTER", extra.letterDocument, extra.letterDocumentData, user.employeeId);
        }

        if (extra.expiryDate) {
            await db.execute(
                `UPDATE authorization_requests SET expiry_date = ? WHERE id = ?`,
                [extra.expiryDate, request.id]
            );
        }

        if (extra.letterReference) {
            auditRemark = `[Ref: ${extra.letterReference}] ${auditRemark || ""}`.trim();
        }

    }

    const actorRoleLabel = action === "MAKER_WITHDRAW"
        ? ROLE_LABELS.MAKER
        : (ROLE_LABELS[role] || role);

    await db.execute(
        `
        INSERT INTO audit_logs (request_id, actor_employee_id, actor_role, action, from_stage, to_stage, remark, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            request.id,
            user.employeeId,
            actorRoleLabel,
            ACTION_LABELS[action] || action,
            request.status,
            nextStage,
            auditRemark,
            note || null
        ]
    );

    return getRequestById(requestNumber, user);

};

const resubmitRequest = async (requestNumber, data, user) => {

    const [rows] = await db.execute(
        `SELECT * FROM authorization_requests WHERE request_number = ?`,
        [requestNumber]
    );

    if (rows.length === 0) {
        throw httpError(404, "Request not found.");
    }

    const request = rows[0];

    if (request.requested_by !== user.employeeId) {
        throw httpError(403, "Only the requester can resubmit this request.");
    }

    if (request.status !== "REQUESTER_REVISION" || !request.return_stage) {
        throw httpError(409, "This request is not awaiting resubmission.");
    }

    const targetStage = request.return_stage;
    const resubmitRemark = String(data.resubmitRemark || data.remark || "").trim();

    await db.execute(
        `
        UPDATE authorization_requests SET
            letter_type = ?, requested_for = ?, requested_for_employee_id = ?,
            department = ?, designation = ?, vendor_name = ?, third_party_id = ?,
            initiate_date = ?, expiry_date = ?, purpose = ?, remark = ?,
            status = ?, return_stage = NULL, updated_at = NOW()
        WHERE id = ?
        `,
        [
            data.letterType,
            data.requestedFor,
            data.requestedForEmployeeId || null,
            data.department,
            data.designation,
            data.vendorName || null,
            data.thirdPartyId || null,
            data.initiateDate,
            data.expiryDate || null,
            data.purpose,
            resubmitRemark,
            targetStage,
            request.id
        ]
    );

    if (data.approvers) {
        await upsertApprovers(request.id, data.approvers);
    }

    await insertDocument(request.id, "KYC", data.kycDocument, data.kycDocumentData, user.employeeId);
    await insertDocument(request.id, "DUE_DILIGENCE", data.dueDiligenceDocument, data.dueDiligenceDocumentData, user.employeeId);

    await db.execute(
        `
        INSERT INTO audit_logs (request_id, actor_employee_id, actor_role, action, from_stage, to_stage, remark)
        VALUES (?, ?, 'Maker', 'Resubmitted After Send Back', 'REQUESTER_REVISION', ?, ?)
        `,
        [request.id, user.employeeId, targetStage, resubmitRemark]
    );

    return getRequestById(requestNumber, user);

};

module.exports = {
    createRequest,
    getRequests,
    getRequestById,
    applyAction,
    resubmitRequest
};
