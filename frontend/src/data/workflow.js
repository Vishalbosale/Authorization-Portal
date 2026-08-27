// Central definition of the AL / POA request lifecycle: stages, buckets,
// role -> stage visibility, and the state-transition rules for each action.
//
// Per the workflow spec: a "Checker" is any user assigned to one tier/bucket
// (HOD, ORMD Head, COO/ED, Secretarial) - they see only their own bucket and
// cannot switch tiers (Admin is the only exception, for oversight). Only the
// Maker can withdraw a request, and only Send Back returns a request to the
// Maker; it always comes straight back to whichever tier sent it back.

export const STAGE = {
    HOD_INITIAL: "HOD_INITIAL",
    ORMD_REVIEW: "ORMD_REVIEW",
    REQUESTER_REVISION: "REQUESTER_REVISION",
    COO_ED_REVIEW: "COO_ED_REVIEW",
    SECRETARIAL: "SECRETARIAL",
    LETTER_ISSUED: "LETTER_ISSUED",
    REJECTED: "REJECTED",
    WITHDRAWN: "WITHDRAWN",
    // Reached only after an issued request goes through the revocation
    // workflow (see data/revocation.js), never through applyAction below.
    REVOKED: "REVOKED"
};

export const STAGE_LABELS = {
    [STAGE.HOD_INITIAL]: "HOD Bucket",
    [STAGE.ORMD_REVIEW]: "ORMD Head Bucket",
    [STAGE.REQUESTER_REVISION]: "Maker Bucket - Sent Back",
    [STAGE.COO_ED_REVIEW]: "COO / ED Bucket",
    [STAGE.SECRETARIAL]: "Secretarial Bucket",
    [STAGE.LETTER_ISSUED]: "Letter Issued / Completed",
    [STAGE.REJECTED]: "Rejected / Closed",
    [STAGE.WITHDRAWN]: "Withdrawn / Closed",
    [STAGE.REVOKED]: "Revoked / Closed"
};

export const TERMINAL_STAGES = [
    STAGE.LETTER_ISSUED,
    STAGE.REJECTED,
    STAGE.WITHDRAWN,
    STAGE.REVOKED
];

// Which stages a given Checker tier can see/act on in their bucket.
export const ROLE_BUCKETS = {
    HOD: [STAGE.HOD_INITIAL],
    ORMD_HEAD: [STAGE.ORMD_REVIEW],
    COO_ED: [STAGE.COO_ED_REVIEW],
    SECRETARIAL: [STAGE.SECRETARIAL]
};

export const ROLE_LABELS = {
    HOD: "HOD",
    ORMD_HEAD: "ORMD Head",
    COO_ED: "COO / ED",
    SECRETARIAL: "Secretarial"
};

// Which actions are available to a Checker at each stage, and whether a
// remark is mandatory for that action. Withdraw is a Maker-only action (see
// MAKER_ACTIONS below) and is intentionally not offered here.
export const STAGE_ACTIONS = {
    [STAGE.HOD_INITIAL]: [
        { action: "APPROVE", label: "Approve", remarkRequired: false, tone: "approve" },
        { action: "REJECT", label: "Reject", remarkRequired: true, tone: "reject" }
    ],
    [STAGE.ORMD_REVIEW]: [
        { action: "APPROVE", label: "Approve", remarkRequired: false, tone: "approve" },
        { action: "SEND_BACK", label: "Send Back", remarkRequired: true, tone: "sendback" },
        { action: "REJECT", label: "Reject", remarkRequired: true, tone: "reject" }
    ],
    [STAGE.COO_ED_REVIEW]: [
        { action: "APPROVE", label: "Approve", remarkRequired: false, tone: "approve" },
        { action: "SEND_BACK", label: "Send Back", remarkRequired: true, tone: "sendback" },
        { action: "REJECT", label: "Reject", remarkRequired: true, tone: "reject" }
    ],
    [STAGE.SECRETARIAL]: [
        { action: "ISSUE_LETTER", label: "Issue AL / POA Letter", remarkRequired: false, tone: "approve" }
    ]
};

// The only action a Maker can take outside of Create/Edit/Resubmit: withdraw
// their own request, at any point before it reaches a terminal stage.
export const MAKER_CAN_WITHDRAW_STAGES = [
    STAGE.HOD_INITIAL,
    STAGE.ORMD_REVIEW,
    STAGE.REQUESTER_REVISION,
    STAGE.COO_ED_REVIEW,
    STAGE.SECRETARIAL
];

export const ACTION_LABELS = {
    APPROVE: "Approved",
    REJECT: "Rejected",
    SEND_BACK: "Sent Back",
    SUBMIT: "Submitted for Final Approval",
    ISSUE_LETTER: "Letter Issued",
    MAKER_WITHDRAW: "Withdrawn"
};

// Pure transition function: given a request's current stage and an action,
// return the next stage and a human-readable audit note. When a Checker
// sends a request back, `returnStage` records which stage resubmission
// should return to - so the request always comes straight back to whoever
// sent it back, never re-entering an earlier tier's bucket.
export function applyAction(currentStage, action) {

    if (action === "MAKER_WITHDRAW") {

        if (MAKER_CAN_WITHDRAW_STAGES.includes(currentStage)) {
            return { nextStage: STAGE.WITHDRAWN, note: "Withdrawn by the Maker." };
        }

        return { nextStage: currentStage, note: "This request can no longer be withdrawn." };

    }

    switch (currentStage) {

        case STAGE.HOD_INITIAL:
            if (action === "APPROVE") {
                return { nextStage: STAGE.ORMD_REVIEW, note: "Approved by HOD. Moved to ORMD Head Bucket." };
            }
            if (action === "REJECT") {
                return { nextStage: STAGE.REJECTED, note: "Rejected by HOD." };
            }
            break;

        case STAGE.ORMD_REVIEW:
            if (action === "APPROVE") {
                   return { nextStage: STAGE.COO_ED_REVIEW, note: "Approved by ORMD Head. Moved to COO / ED Bucket." };
            }
            if (action === "SEND_BACK") {
                return {
                    nextStage: STAGE.REQUESTER_REVISION,
                    returnStage: STAGE.ORMD_REVIEW,
                    note: "Sent back by ORMD Head to the Maker."
                };
            }
            if (action === "REJECT") {
                return { nextStage: STAGE.REJECTED, note: "Rejected by ORMD Head." };
            }
            break;

        case STAGE.COO_ED_REVIEW:
            if (action === "APPROVE") {
                return { nextStage: STAGE.SECRETARIAL, note: "Approved by COO / ED. Moved to Secretarial Bucket for letter issuance." };
            }
            if (action === "SEND_BACK") {
                return {
                    nextStage: STAGE.REQUESTER_REVISION,
                    returnStage: STAGE.COO_ED_REVIEW,
                    note: "Sent back by COO / ED to the Maker."
                };
            }
            if (action === "REJECT") {
                return { nextStage: STAGE.REJECTED, note: "Rejected by COO / ED." };
            }
            break;

        case STAGE.SECRETARIAL:
            if (action === "ISSUE_LETTER") {
                return { nextStage: STAGE.LETTER_ISSUED, note: "AL / POA Letter issued by Secretarial. Request completed." };
            }
            break;

        default:
            break;
    }

    return { nextStage: currentStage, note: "No transition available for this action at the current stage." };
}

// Canonical happy-path order, used to render the Tracking timeline.
export const HAPPY_PATH = [
    STAGE.HOD_INITIAL,
    STAGE.ORMD_REVIEW,
    STAGE.COO_ED_REVIEW,
    STAGE.SECRETARIAL,
    STAGE.LETTER_ISSUED
];

export const TIMELINE_STEP_LABELS = {
    [STAGE.HOD_INITIAL]: "HOD Bucket",
    [STAGE.ORMD_REVIEW]: "ORMD Head Review",
    [STAGE.COO_ED_REVIEW]: "COO / ED - Final Approval",
    [STAGE.SECRETARIAL]: "Secretarial - Letter Issuance",
    [STAGE.LETTER_ISSUED]: "Letter Issued"
};

export function formatDateTime(isoString) {

    if (!isoString) {
        return "";
    }

    const date = new Date(isoString);

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}
