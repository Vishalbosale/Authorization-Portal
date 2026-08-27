import { useState } from "react";

import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    Building2,
    Check,
    CheckCircle2,
    FileSignature,
    FilePlus2,
    FileText,
    FolderCheck,
    Hourglass,
    PenLine,
    Route as RouteIcon,
    ShieldCheck,
    ShieldOff,
    Undo2,
    UserRound,
    XCircle
} from "lucide-react";

import {
    REVOCATION_REASONS
} from "../../data/revocation";

import "./Workflow.css";


const WORKFLOW_STEPS = [

    {
        number: 1,
        title: "Request Submission",
        shortTitle: "Submission",
        icon: FilePlus2,

        description:
            "The Maker creates and submits the AL / POA request. A unique Request ID is generated and the request enters the HOD Bucket.",

        details: [
            "Maker creates and submits the AL / POA request.",
            "System generates a unique Request ID.",
            "Request enters the HOD Bucket.",
            "HOD and Maker receive an email notification containing the request details and Request ID.",
            "Complete submission details are stored in the database and an audit entry is created."
        ]
    },

    {
        number: 2,
        title: "HOD Bucket",
        shortTitle: "HOD",
        icon: UserRound,

        description:
            "The HOD (a Checker assigned to the HOD tier) opens the request and reviews everything submitted by the Maker before approving or rejecting it.",

        details: [
            "HOD can view request details, Maker details, supporting documents, previous remarks, current status and the complete audit trail.",
            "HOD reviews the request and takes action: Approve or Reject.",
            "If approved, the request moves to the ORMD Head Bucket and relevant stakeholders are notified.",
            "If rejected, the request moves to Rejected / Closed status and the Maker is notified. Only the Maker can withdraw a request - approvers do not have a Withdraw action."
        ]
    },

    {
        number: 3,
        title: "ORMD Head - Review",
        shortTitle: "ORMD Head",
        icon: ShieldCheck,

        description:
            "The ORMD Head Checker can view the complete request along with all previous information and audit history, then chooses one of three actions.",

        details: [
            "Available actions: Approve, Send Back, Reject.",
            "Approve - request moves directly to the COO / ED Bucket.",
            "Send Back - request moves to the Maker with remarks; the Maker corrects it and, on resubmission, it goes directly back to the ORMD Head Bucket (HOD is not re-involved).",
            "Reject - request moves to Rejected / Closed status; the Maker is notified."
        ]
    },

    {
        number: 4,
        title: "Maker Revision (If Sent Back)",
        shortTitle: "Revision",
        icon: PenLine,

        description:
            "Whenever a Checker sends a request back - whether from ORMD Head or COO / ED - it always returns to the Maker, who corrects it and resubmits straight back to whichever tier sent it back.",

        details: [
            "Maker receives a notification containing the Send Back remarks.",
            "Maker modifies / corrects the request and submits it again.",
            "The request moves directly back to the tier that sent it back - ORMD Head or COO / ED - never through an earlier tier.",
            "The complete history of the original submission and every resubmission remains available in the audit trail; nothing is overwritten."
        ]
    },

    {
        number: 5,
        title: "COO / ED - Final Approval Stage",
        shortTitle: "COO / ED",
        icon: Building2,

        description:
            "The COO / ED Checker receives the request with complete information and audit history and provides the final approval decision.",

        details: [
            "Available actions: Approve, Send Back, Reject.",
            "Approve - request moves to the Secretarial Bucket.",
            "Send Back - request moves directly to the Maker (not to HOD); once corrected and resubmitted, it returns directly to the COO / ED Bucket.",
            "Reject - request moves to Rejected / Closed status; Maker and relevant stakeholders are notified."
        ]
    },

    {
        number: 6,
        title: "Secretarial - AL / POA Letter Issuance",
        shortTitle: "Letter Issued",
        icon: FileSignature,

        description:
            "After COO / ED approval, Secretarial issues the final AL / POA Letter and the request is completed. Secretarial is not an approval role.",

        details: [
            "Request enters the Secretarial Bucket after COO / ED approval.",
            "Secretarial user can view the complete approved request and audit trail.",
            "Secretarial issues the final AL / POA Letter and can attach the issued document.",
            "Request status changes to Letter Issued / Completed.",
            "Final notification is sent to the Maker and other relevant stakeholders."
        ]
    }

];


const APPROVAL_CHAIN = [
    { icon: UserRound, title: "Maker", caption: "Raises Request" },
    { icon: UserRound, title: "HOD", caption: "Approve / Reject" },
    { icon: ShieldCheck, title: "ORMD Head", caption: "Approve / Send Back / Reject" },
    { icon: Building2, title: "COO / ED", caption: "Approve / Send Back / Reject" },
    { icon: FolderCheck, title: "Secretarial", caption: "Issues AL / POA Letter" },
    { icon: FileText, title: "Letter Issued", caption: "Process Completed", isLetter: true }
];


// The revocation flow runs after a letter has been issued and reverses it.
// It is deliberately a different chain from the approval one: the HOD who
// approved the request raises it, Secretarial approves, ORMD Head closes it.
const REVOCATION_CHAIN = [
    { icon: UserRound, title: "HOD", caption: "Raises Revocation" },
    { icon: FolderCheck, title: "Secretarial", caption: "Approve / Reject" },
    { icon: ShieldCheck, title: "ORMD Head", caption: "Final Approval" },
    { icon: XCircle, title: "Revoked", caption: "Letter Reversed", isRevoked: true }
];


const REVOCATION_STAGES = [

    {
        number: 1,
        title: "HOD Raises the Revocation",
        icon: ShieldOff,

        details: [
            "Only the HOD who approved the original request can revoke it, and only once its AL / POA letter has been issued.",
            "The HOD opens Approvals - Issued - Revocable and selects Revoke on the letter concerned.",
            "A revocation reason is chosen from the six configured reasons; each one makes its own fields and supporting documents mandatory.",
            "The HOD nominates the Secretarial and ORMD Head approvers for this revocation before submitting.",
            "A request can carry only one open revocation at a time, and a request already revoked cannot be revoked again."
        ]
    },

    {
        number: 2,
        title: "Secretarial - Approval",
        icon: FolderCheck,

        details: [
            "The nominated Secretarial approver sees the revocation in Approvals - Revocations.",
            "They can view the revocation reason, the supporting documents and the original request in full.",
            "Approve - the revocation moves to the ORMD Head for final approval.",
            "Reject - the revocation closes as Revocation Rejected and the letter remains valid."
        ]
    },

    {
        number: 3,
        title: "ORMD Head - Final Approval",
        icon: ShieldCheck,

        details: [
            "The nominated ORMD Head approver takes the final decision on the revocation.",
            "Approve - the revocation closes and the parent request moves to Revoked / Closed. The issued AL / POA letter is no longer valid.",
            "Reject - the revocation closes as Revocation Rejected and the letter remains valid.",
            "Either way the outcome, the actor and the remark are written to the audit trail."
        ]
    }

];


const INFORMATION_CARDS = [

    {
        icon: ShieldCheck,
        title: "Role-Based Access",
        copy: "Once logged in, the portal automatically shows you the right pages and requests for your role. A Checker cannot manually switch tiers - they only ever see the bucket they are assigned to (Admin is the only role that can view every tier, for oversight)."
    },

    {
        icon: Hourglass,
        title: "Track Your Request",
        copy: "My Requests and the Tracking page show the current bucket and complete audit trail for your request. Makers see only their own requests; Checkers see requests assigned to or actioned by them; Admin sees everything."
    },

    {
        icon: Undo2,
        title: "Send Back",
        copy: "Any Send Back - from ORMD Head or COO / ED - always returns the request to the Maker with remarks. Once corrected and resubmitted, it goes directly back to whichever tier sent it back."
    },

    {
        icon: AlertTriangle,
        title: "Rejection & Withdrawal",
        copy: "A Reject by a Checker closes the request immediately. Withdraw is a Maker-only action, available at any point before the letter is issued - approvers cannot withdraw a request. Both are recorded in the audit trail."
    },

    {
        icon: FileText,
        title: "Letter Issuance",
        copy: "Once COO / ED gives final approval, Secretarial issues and attaches the AL / POA Letter, and the request status becomes Letter Issued / Completed."
    },

    {
        icon: ShieldOff,
        title: "Revocation",
        copy: "An issued letter can be reversed through the revocation flow: the HOD who approved it raises the revocation, Secretarial approves and the ORMD Head gives final approval. The request then becomes Revoked / Closed."
    }

];


function Workflow() {

    const [activeStep, setActiveStep] = useState(1);

    const active = WORKFLOW_STEPS[activeStep - 1];
    const ActiveIcon = active.icon;


    const handleStepClick = (step) => {
        setActiveStep(step.number);
    };


    return (

        <div className="workflow-page">


            {/* =====================================
                PAGE HEADER
            ====================================== */}

            <div className="workflow-header">

                <span className="workflow-header-icon">
                    <RouteIcon size={24} />
                </span>

                <div>

                    <span className="section-kicker">
                        Process Guide
                    </span>

                    <h1>
                        AL / POA Approval Workflow
                    </h1>

                    <p>
                        Every stage a request passes through, who acts on it,
                        and what each action does.
                    </p>

                </div>

            </div>


            {/* =====================================
                WORKFLOW OVERVIEW
            ====================================== */}

            <div className="workflow-introduction">

                <h2>
                    How Does the AL / POA Approval Process Work?
                </h2>

                <p>
                    Every AL / POA request moves through five buckets -
                    Maker, HOD, ORMD Head, COO / ED and Secretarial. A
                    request is visible in exactly one bucket at a time; it is
                    never sitting in more than one approver's queue at once.
                    HOD reviews the request on initial submission. At the
                    ORMD Head and COO / ED stages, a request can be Sent Back
                    for correction (it always returns to the Maker, then
                    goes straight back to whichever tier sent it) or
                    Rejected. Only the Maker can withdraw a request, at any
                    point before the letter is issued. Every transition is
                    fully recorded in an immutable audit trail. Once COO / ED
                    gives final approval, Secretarial issues the AL / POA
                    Letter and the request is complete.
                </p>

            </div>


            {/* =====================================
                STEP LIST
            ====================================== */}

            <div className="workflow-process">

                {WORKFLOW_STEPS.map((step, index) => {

                    const StepIcon = step.icon;

                    return (

                        <div
                            key={step.number}
                            className={
                                activeStep === step.number
                                    ? "workflow-step active"
                                    : "workflow-step"
                            }
                            style={{ "--i": index }}
                            onClick={() => handleStepClick(step)}
                            onKeyDown={(event) => {

                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    handleStepClick(step);
                                }

                            }}
                            tabIndex={0}
                            role="button"
                            aria-label={`Open ${step.title} stage`}
                            aria-current={
                                activeStep === step.number
                                    ? "step"
                                    : undefined
                            }
                        >

                            <div className="workflow-step-number">
                                <span>{step.number}</span>
                            </div>

                            <div className="workflow-step-icon">
                                <StepIcon size={20} />
                            </div>

                            <h3>{step.title}</h3>

                            <p>{step.description}</p>

                            {index < WORKFLOW_STEPS.length - 1 && (
                                <div className="workflow-arrow">
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 12 12"
                                        fill="none"
                                        aria-hidden="true"
                                    >
                                        <path
                                            d="M6 1v9m0 0L2 6.5M6 10l4-3.5"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </div>
                            )}

                        </div>

                    );

                })}

            </div>


            {/* =====================================
                STEP DETAILS
            ====================================== */}

            <div className="workflow-details" key={activeStep}>

                <div className="workflow-details-header">

                    <div className="workflow-details-icon">
                        <ActiveIcon size={22} />
                    </div>

                    <div>

                        <span>STEP {activeStep}</span>

                        <h2>{active.title}</h2>

                    </div>

                </div>


                <p className="workflow-details-description">
                    {active.description}
                </p>


                <div className="workflow-details-list">

                    <h3>What happens at this stage?</h3>

                    <ul>

                        {active.details.map((detail, index) => (

                            <li
                                key={detail}
                                style={{ "--i": index }}
                            >

                                <span className="check-icon">
                                    <Check size={12} strokeWidth={3} />
                                </span>

                                {detail}

                            </li>

                        ))}

                    </ul>

                </div>


                {/* NAVIGATION */}

                <div className="workflow-navigation">

                    <button
                        type="button"
                        disabled={activeStep === 1}
                        onClick={() => setActiveStep(activeStep - 1)}
                    >
                        <ArrowLeft size={15} />
                        Previous
                    </button>


                    <div className="workflow-progress">

                        {WORKFLOW_STEPS.map((step) => (

                            <button
                                key={step.number}
                                type="button"
                                className={
                                    activeStep === step.number
                                        ? "selected"
                                        : ""
                                }
                                onClick={() => setActiveStep(step.number)}
                                aria-label={`Go to step ${step.number}: ${step.shortTitle}`}
                            />

                        ))}

                    </div>


                    <button
                        type="button"
                        disabled={activeStep === WORKFLOW_STEPS.length}
                        onClick={() => setActiveStep(activeStep + 1)}
                    >
                        Next
                        <ArrowRight size={15} />
                    </button>

                </div>

            </div>


            {/* =====================================
                APPROVAL FLOW
            ====================================== */}

            <div className="approval-section">

                <h2>Approval Hierarchy</h2>

                <p>
                    Every request follows this configured bucket sequence
                    before the AL / POA letter can be issued. Send Back and
                    Reject actions can branch off at the ORMD Head and
                    COO / ED stages (see below); the Maker can withdraw at
                    any point.
                </p>


                <div className="approval-flow">

                    {APPROVAL_CHAIN.map((node, index) => {

                        const NodeIcon = node.icon;

                        return (

                            <div
                                className="approval-node"
                                key={node.title}
                                style={{ "--i": index }}
                            >

                                <div
                                    className={
                                        node.isLetter
                                            ? "approval-box letter-box"
                                            : "approval-box"
                                    }
                                >

                                    <div>
                                        {node.isLetter
                                            ? <CheckCircle2 size={20} />
                                            : <NodeIcon size={20} />}
                                    </div>

                                    <strong>{node.title}</strong>

                                    <span>{node.caption}</span>

                                </div>


                                {index < APPROVAL_CHAIN.length - 1 && (
                                    <div className="approval-line">
                                        <ArrowRight size={16} />
                                    </div>
                                )}

                            </div>

                        );

                    })}

                </div>

            </div>


            {/* =====================================
                REVOCATION WORKFLOW
            ====================================== */}

            <div className="approval-section revocation-section">

                <div className="revocation-heading">

                    <span className="revocation-heading-icon">
                        <ShieldOff size={22} />
                    </span>

                    <div>

                        <span className="section-kicker">
                            After the letter is issued
                        </span>

                        <h2>Revocation Workflow</h2>

                    </div>

                </div>


                <p>
                    Revocation reverses an AL / POA letter that has already
                    been issued - when a third party is discontinued, an
                    employee resigns or transfers, the authority is
                    surrendered, or the original letter is lost. It runs as
                    its own three-stage flow, separate from the approval
                    chain above: the HOD who approved the request raises it,
                    Secretarial approves, and the ORMD Head gives final
                    approval. Only then does the request become Revoked /
                    Closed. Every step is recorded in the same audit trail as
                    the original request.
                </p>


                <div className="approval-flow">

                    {REVOCATION_CHAIN.map((node, index) => {

                        const NodeIcon = node.icon;

                        return (

                            <div
                                className="approval-node"
                                key={node.title}
                                style={{ "--i": index }}
                            >

                                <div
                                    className={
                                        node.isRevoked
                                            ? "approval-box revoked-box"
                                            : "approval-box"
                                    }
                                >

                                    <div>
                                        <NodeIcon size={20} />
                                    </div>

                                    <strong>{node.title}</strong>

                                    <span>{node.caption}</span>

                                </div>


                                {index < REVOCATION_CHAIN.length - 1 && (
                                    <div className="approval-line">
                                        <ArrowRight size={16} />
                                    </div>
                                )}

                            </div>

                        );

                    })}

                </div>


                <div className="revocation-stages">

                    {REVOCATION_STAGES.map((stage, index) => {

                        const StageIcon = stage.icon;

                        return (

                            <div
                                className="revocation-stage"
                                key={stage.number}
                                style={{ "--i": index }}
                            >

                                <div className="revocation-stage-head">

                                    <span className="revocation-stage-icon">
                                        <StageIcon size={18} />
                                    </span>

                                    <div>
                                        <span>STAGE {stage.number}</span>
                                        <h3>{stage.title}</h3>
                                    </div>

                                </div>


                                <ul>

                                    {stage.details.map((detail) => (

                                        <li key={detail}>

                                            <span className="check-icon">
                                                <Check size={12} strokeWidth={3} />
                                            </span>

                                            {detail}

                                        </li>

                                    ))}

                                </ul>

                            </div>

                        );

                    })}

                </div>


                <div className="revocation-reasons">

                    <h3>Accepted Revocation Reasons</h3>

                    <p>
                        The reason chosen decides which extra fields and
                        supporting documents the HOD must provide, and which
                        reasons are offered depends on who the original
                        request was raised for.
                    </p>

                    <ul>

                        {REVOCATION_REASONS.map((reason) => (

                            <li key={reason.code}>

                                <strong>{reason.label}</strong>

                                <span className="revocation-reason-scope">
                                    {reason.appliesTo.join(" · ")}
                                </span>

                            </li>

                        ))}

                    </ul>

                </div>

            </div>


            {/* =====================================
                IMPORTANT INFORMATION
            ====================================== */}

            <div className="workflow-information">

                {INFORMATION_CARDS.map((card, index) => {

                    const CardIcon = card.icon;

                    return (

                        <div
                            className="information-card"
                            key={card.title}
                            style={{ "--i": index }}
                        >

                            <div className="information-icon">
                                <CardIcon size={19} />
                            </div>

                            <div>

                                <h3>{card.title}</h3>

                                <p>{card.copy}</p>

                            </div>

                        </div>

                    );

                })}

            </div>

        </div>

    );

}

export default Workflow;
