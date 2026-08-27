// Server-side mirror of frontend/src/data/workflow.js's STAGE machine.
// Keep the transition table in sync with that file if the workflow spec changes.

const STAGE = {
    HOD_INITIAL: "HOD_INITIAL",
    ORMD_REVIEW: "ORMD_REVIEW",
    REQUESTER_REVISION: "REQUESTER_REVISION",
    COO_ED_REVIEW: "COO_ED_REVIEW",
    SECRETARIAL: "SECRETARIAL",
    LETTER_ISSUED: "LETTER_ISSUED",
    REJECTED: "REJECTED",
    WITHDRAWN: "WITHDRAWN",
    // Reached only via the revocation workflow (see revocationEngine.js),
    // never through computeTransition below.
    REVOKED: "REVOKED"
};

const MAKER_CAN_WITHDRAW_STAGES = [
    STAGE.HOD_INITIAL,
    STAGE.ORMD_REVIEW,
    STAGE.REQUESTER_REVISION,
    STAGE.COO_ED_REVIEW,
    STAGE.SECRETARIAL
];

const ACTION_LABELS = {
    APPROVE: "Approved",
    REJECT: "Rejected",
    SEND_BACK: "Sent Back",
    ISSUE_LETTER: "Letter Issued",
    MAKER_WITHDRAW: "Withdrawn"
};

// Which Checker role is authorized to act while a request sits at a given stage.
const STAGE_APPROVER_ROLE = {
    [STAGE.HOD_INITIAL]: "HOD",
    [STAGE.ORMD_REVIEW]: "ORMD_HEAD",
    [STAGE.COO_ED_REVIEW]: "COO_ED",
    [STAGE.SECRETARIAL]: "SECRETARIAL"
};

const ROLE_LABELS = {
    MAKER: "Maker",
    HOD: "HOD",
    ORMD_HEAD: "ORMD Head",
    COO_ED: "COO / ED",
    SECRETARIAL: "Secretarial",
    ADMIN: "Admin"
};

function computeTransition(currentStage, action) {

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

module.exports = {
    STAGE,
    MAKER_CAN_WITHDRAW_STAGES,
    ACTION_LABELS,
    STAGE_APPROVER_ROLE,
    ROLE_LABELS,
    computeTransition
};
