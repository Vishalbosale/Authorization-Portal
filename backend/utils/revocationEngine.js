// Server-side mirror of frontend/src/data/revocation.js.
// Keep the reason catalogue and the transition table in sync with that file.
//
// Revocation workflow (spec: "Request Revocation Flow"):
//     HOD initiates -> Secretarial approves -> ORMD Head (final approval)
// Once ORMD Head approves, the revocation closes and the parent request moves
// to REVOKED.

const REVOCATION_STAGE = {
    SECRETARIAL_REVIEW: "SECRETARIAL_REVIEW",
    ORMD_FINAL: "ORMD_FINAL",
    REVOKED: "REVOKED",
    REJECTED: "REJECTED"
};


const REVOCATION_STAGE_LABELS = {
    [REVOCATION_STAGE.SECRETARIAL_REVIEW]: "Secretarial - Approval",
    [REVOCATION_STAGE.ORMD_FINAL]: "ORMD Head - Final Approval",
    [REVOCATION_STAGE.REVOKED]: "Revoked / Closed",
    [REVOCATION_STAGE.REJECTED]: "Revocation Rejected"
};


// Which role may act while a revocation sits at a given stage.
const REVOCATION_STAGE_ROLE = {
    [REVOCATION_STAGE.SECRETARIAL_REVIEW]: "SECRETARIAL",
    [REVOCATION_STAGE.ORMD_FINAL]: "ORMD_HEAD"
};


const REVOCATION_APPROVER_KEY_TO_STAGE = {
    secretarial: REVOCATION_STAGE.SECRETARIAL_REVIEW,
    ormdHead: REVOCATION_STAGE.ORMD_FINAL
};


const ORIGINAL_SUBMISSION_OPTIONS = [
    "Yes",
    "No",
    "Not Applicable"
];


const ADVERTISEMENT_HINT =
    "Kindly upload a zip containing: 1. copy of the advertisement in a local " +
    "newspaper (regional language), 2. copy of the advertisement in a national " +
    "English-language newspaper.";


// The six revocation reasons. `appliesTo` gates which reasons a given request
// can use (its requested_for value), `fields` lists the extra inputs that
// reason makes mandatory, and `documents` the mandatory uploads.
const REVOCATION_REASONS = [

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


const REVOCATION_ACTION_LABELS = {
    INITIATE: "Revocation Initiated",
    APPROVE: "Revocation Approved",
    REJECT: "Revocation Rejected"
};


const FIELD_LABELS = {
    dateOfRevocation: "Date of Revocation",
    letterLostDate: "Letter Lost Date",
    location: "Location",
    originalSubmissionConfirmation: "Confirmation of submission of original AL / POA",
    lossActionTaken: "Action taken for loss of original AL / POA"
};


function getReason(code) {

    return REVOCATION_REASONS.find((reason) => reason.code === code) || null;

}


function getReasonsFor(requestedFor) {

    return REVOCATION_REASONS.filter(
        (reason) => reason.appliesTo.includes(requestedFor)
    );

}


// Returns an array of human-readable problems; empty means the payload is
// complete for the chosen reason.
function validateRevocationPayload(reason, payload) {

    const problems = [];

    if (!String(payload?.reasonText || "").trim()) {
        problems.push(`${reason.reasonLabel} is required.`);
    }

    for (const field of reason.fields) {

        if (!String(payload?.[field] || "").trim()) {
            problems.push(`${FIELD_LABELS[field]} is required.`);
        }

    }

    if (
        reason.fields.includes("originalSubmissionConfirmation") &&
        payload?.originalSubmissionConfirmation &&
        !ORIGINAL_SUBMISSION_OPTIONS.includes(payload.originalSubmissionConfirmation)
    ) {
        problems.push("Confirmation of submission of original AL / POA is not a valid option.");
    }

    for (const document of reason.documents) {

        const uploaded = payload?.documents?.[document.type];

        if (!uploaded?.data) {
            problems.push(`${document.label} is required.`);
        }

    }

    return problems;

}


function computeRevocationTransition(currentStage, action) {

    switch (currentStage) {

        case REVOCATION_STAGE.SECRETARIAL_REVIEW:

            if (action === "APPROVE") {
                return {
                    nextStage: REVOCATION_STAGE.ORMD_FINAL,
                    note: "Revocation approved by Secretarial. Moved to ORMD Head for final approval."
                };
            }

            if (action === "REJECT") {
                return {
                    nextStage: REVOCATION_STAGE.REJECTED,
                    note: "Revocation rejected by Secretarial."
                };
            }

            break;

        case REVOCATION_STAGE.ORMD_FINAL:

            if (action === "APPROVE") {
                return {
                    nextStage: REVOCATION_STAGE.REVOKED,
                    note: "Revocation given final approval by ORMD Head. The request is now revoked.",
                    revokesParent: true
                };
            }

            if (action === "REJECT") {
                return {
                    nextStage: REVOCATION_STAGE.REJECTED,
                    note: "Revocation rejected by ORMD Head."
                };
            }

            break;

        default:
            break;

    }

    return {
        nextStage: currentStage,
        note: "No action is available for this revocation at its current stage."
    };

}


module.exports = {
    REVOCATION_STAGE,
    REVOCATION_STAGE_LABELS,
    REVOCATION_STAGE_ROLE,
    REVOCATION_APPROVER_KEY_TO_STAGE,
    REVOCATION_REASONS,
    REVOCATION_ACTION_LABELS,
    ORIGINAL_SUBMISSION_OPTIONS,
    FIELD_LABELS,
    getReason,
    getReasonsFor,
    validateRevocationPayload,
    computeRevocationTransition
};
