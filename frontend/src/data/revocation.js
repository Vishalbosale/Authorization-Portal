// Client-side mirror of backend/utils/revocationEngine.js.
// Keep the reason catalogue and stage labels in sync with that file.
//
// Revocation workflow (spec: "Request Revocation Flow"):
//     HOD initiates -> Secretarial approves -> ORMD Head (final approval)
// Once ORMD Head approves, the revocation closes and the parent request
// becomes REVOKED. Only the HOD who previously approved a request can revoke
// it, and only once its letter has been issued.

import {
    STAGE
} from "./workflow";


export const REVOCATION_STAGE = {
    SECRETARIAL_REVIEW: "SECRETARIAL_REVIEW",
    ORMD_FINAL: "ORMD_FINAL",
    REVOKED: "REVOKED",
    REJECTED: "REJECTED"
};


export const REVOCATION_STAGE_LABELS = {
    [REVOCATION_STAGE.SECRETARIAL_REVIEW]: "Secretarial - Approval",
    [REVOCATION_STAGE.ORMD_FINAL]: "ORMD Head - Final Approval",
    [REVOCATION_STAGE.REVOKED]: "Revoked / Closed",
    [REVOCATION_STAGE.REJECTED]: "Revocation Rejected"
};


// Which role may act while a revocation sits at a given stage.
export const REVOCATION_STAGE_ROLE = {
    [REVOCATION_STAGE.SECRETARIAL_REVIEW]: "SECRETARIAL",
    [REVOCATION_STAGE.ORMD_FINAL]: "ORMD_HEAD"
};


export const REVOCATION_OPEN_STAGES = [
    REVOCATION_STAGE.SECRETARIAL_REVIEW,
    REVOCATION_STAGE.ORMD_FINAL
];


// The roles that review a revocation: Secretarial, then ORMD Head.
export const REVOCATION_APPROVER_ROLES = Object.values(REVOCATION_STAGE_ROLE);


// Only the HOD who approved a request may revoke it, and only once its letter
// has been issued - this mirrors the server-side rule. Shared by the Approvals
// screen, the header badge and the home dashboard so all three agree.
export function selectRevocableRequests({
    requests = [],
    revocations = [],
    actingRole,
    isAdmin = false,
    employeeId,
    actorString
}) {

    if (actingRole !== "HOD") {
        return [];
    }

    const byRequest = {};

    for (const revocation of revocations) {
        (byRequest[revocation.requestId] ||= []).push(revocation);
    }

    return requests
        .filter((request) => {

            if (request.status !== STAGE.LETTER_ISSUED) {
                return false;
            }

            const blocked = (byRequest[request.id] || []).some(
                (revocation) =>
                    REVOCATION_OPEN_STAGES.includes(revocation.status) ||
                    revocation.status === REVOCATION_STAGE.REVOKED
            );

            if (blocked) {
                return false;
            }

            if (isAdmin) {
                return true;
            }

            const wasAssignedHod = request.approvers?.hod === employeeId;

            const approvedByMe = (request.audit || []).some(
                (entry) =>
                    entry.actor === actorString &&
                    entry.fromStage === STAGE.HOD_INITIAL &&
                    entry.toStage === STAGE.ORMD_REVIEW
            );

            return wasAssignedHod && approvedByMe;

        })
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

}


// Revocations this user may see: the ones they raised, plus the ones assigned
// to them at a stage their acting role owns. Admin sees everything.
export function selectVisibleRevocations({
    revocations = [],
    actingRole,
    isAdmin = false,
    employeeId
}) {

    const stagesForRole = Object.entries(REVOCATION_STAGE_ROLE)
        .filter(([, role]) => role === actingRole)
        .map(([stage]) => stage);

    return revocations
        .filter((revocation) => {

            if (isAdmin) {
                return true;
            }

            if (revocation.initiatedBy?.employeeId === employeeId) {
                return true;
            }

            return stagesForRole.some((stage) => {

                const key = stage === REVOCATION_STAGE.SECRETARIAL_REVIEW
                    ? "secretarial"
                    : "ormdHead";

                return revocation.approvers?.[key] === employeeId;

            });

        })
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

}


// How many of those revocations are waiting on this role right now. Admin has
// no revocation bucket of its own, so it gets every open revocation instead.
export function countPendingRevocations(visibleRevocations, actingRole, isAdmin = false) {

    if (isAdmin) {
        return visibleRevocations.filter(
            (revocation) => REVOCATION_OPEN_STAGES.includes(revocation.status)
        ).length;
    }

    return visibleRevocations.filter(
        (revocation) => REVOCATION_STAGE_ROLE[revocation.status] === actingRole
    ).length;

}


export const ORIGINAL_SUBMISSION_OPTIONS = [
    "Yes",
    "No",
    "Not Applicable"
];


const ADVERTISEMENT_HINT =
    "Kindly upload a zip containing: 1. copy of the advertisement in a local " +
    "newspaper (regional language), 2. copy of the advertisement in a national " +
    "English-language newspaper.";


// The six revocation reasons. `appliesTo` gates which reasons a request can
// use (its requestedFor value), `fields` lists the extra inputs that reason
// makes mandatory, and `documents` the mandatory uploads.
export const REVOCATION_REASONS = [

    {
        code: "TP_DISCONTINUATION",
        label: "Discontinuation or Termination of Third Party or Its Employee",
        appliesTo: ["Third Party"],
        reasonLabel: "Revoke Reason",
        reasonPlaceholder: "Describe the discontinuation or termination",
        fields: ["dateOfRevocation"],
        documents: []
    },

    {
        code: "TP_QUARTERLY_RECONCILIATION",
        label: "Post Quarterly Reconciliation - Third Party",
        appliesTo: ["Third Party"],
        reasonLabel: "Reason",
        reasonPlaceholder: "e.g. Reconciliation - no longer required",
        fields: ["dateOfRevocation"],
        documents: []
    },

    {
        code: "TP_LOSS",
        label: "Revocation of POA / AL Due to Loss - Third Party",
        appliesTo: ["Third Party"],
        reasonLabel: "Reason",
        reasonPlaceholder: "Describe the circumstances of the loss",
        fields: ["dateOfRevocation"],
        documents: []
    },

    {
        code: "EMP_RESIGNATION_TRANSFER",
        label: "Resignation / Transfer of Employee",
        appliesTo: ["Self", "Others"],
        reasonLabel: "Reason",
        reasonPlaceholder: "e.g. Resignation accepted with effect from ...",
        fields: ["originalSubmissionConfirmation", "lossActionTaken"],
        documents: [
            {
                type: "SUPPORTING",
                label: "Supporting documents",
                hint: "e.g. resignation acceptance, movement to another team or role"
            },
            {
                type: "FIR_REPORT",
                label: "FIR or non-cognizable report"
            },
            {
                type: "ADVERTISEMENT_CLIPPINGS",
                label: "Advertisement clippings",
                hint: ADVERTISEMENT_HINT
            }
        ]
    },

    {
        code: "EMP_SURRENDER",
        label: "Surrender of AL / POA During Period of Service",
        appliesTo: ["Self", "Others"],
        reasonLabel: "Reason",
        reasonPlaceholder: "e.g. Surrendered - no longer required for the role",
        fields: [],
        documents: []
    },

    {
        code: "EMP_LOSS",
        label: "Revocation of POA Due to Loss - Employee",
        appliesTo: ["Self", "Others"],
        reasonLabel: "Reason",
        reasonPlaceholder: "Describe the circumstances of the loss",
        fields: ["location", "letterLostDate"],
        documents: [
            {
                type: "FIR_REPORT",
                label: "FIR or non-cognizable report"
            },
            {
                type: "ADVERTISEMENT_CLIPPINGS",
                label: "Advertisement clippings",
                hint: ADVERTISEMENT_HINT
            }
        ]
    }

];


export const REVOCATION_FIELD_LABELS = {
    dateOfRevocation: "Date of Revocation",
    letterLostDate: "Letter Lost Date",
    location: "Location",
    originalSubmissionConfirmation: "Confirmation of submission of original AL / POA",
    lossActionTaken: "Action taken for loss of original AL / POA"
};


export const REVOCATION_DOCUMENT_LABELS = {
    SUPPORTING: "Supporting documents",
    FIR_REPORT: "FIR or non-cognizable report",
    ADVERTISEMENT_CLIPPINGS: "Advertisement clippings"
};


export function getRevocationReason(code) {

    return REVOCATION_REASONS.find((reason) => reason.code === code) || null;

}


export function getRevocationReasonsFor(requestedFor) {

    return REVOCATION_REASONS.filter(
        (reason) => reason.appliesTo.includes(requestedFor)
    );

}


// Mirrors validateRevocationPayload on the server, so the HOD sees problems
// inline instead of as a round-tripped error.
export function validateRevocationForm(reason, form) {

    const problems = [];

    if (!reason) {
        problems.push("Select a revocation reason.");
        return problems;
    }

    if (!String(form.reasonText || "").trim()) {
        problems.push(`${reason.reasonLabel} is required.`);
    }

    for (const field of reason.fields) {

        if (!String(form[field] || "").trim()) {
            problems.push(`${REVOCATION_FIELD_LABELS[field]} is required.`);
        }

    }

    for (const document of reason.documents) {

        if (!form.documents?.[document.type]?.data) {
            problems.push(`${document.label} is required.`);
        }

    }

    if (!form.approvers?.secretarial || !form.approvers?.ormdHead) {
        problems.push("Select both the Secretarial and the ORMD Head approver.");
    }

    return problems;

}
