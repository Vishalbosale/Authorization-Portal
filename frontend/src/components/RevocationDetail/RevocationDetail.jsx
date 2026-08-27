import {
    useEffect,
    useState
} from "react";

import {
    createPortal
} from "react-dom";

import {
    Download,
    ShieldOff
} from "lucide-react";

import {
    REVOCATION_DOCUMENT_LABELS,
    REVOCATION_STAGE,
    REVOCATION_STAGE_LABELS,
    REVOCATION_STAGE_ROLE,
    getRevocationReason
} from "../../data/revocation";

import {
    formatDateTime
} from "../../data/workflow";

import "./RevocationDetail.css";


function formatDate(value) {

    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });

}


function downloadDocument(document_) {

    if (!document_?.data) {
        return;
    }

    const link = document.createElement("a");

    link.href = document_.data;
    link.download = document_.fileName || "revocation-document";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

}


function Field({ label, value }) {

    return (

        <div className="revocation-field">
            <span>{label}</span>
            <strong>{value || "-"}</strong>
        </div>

    );

}


function RevocationDetailModal({ revocation, user, onClose, onAction }) {

    const isOpen = Boolean(revocation);

    const [remark, setRemark] = useState("");
    const [busy, setBusy] = useState(false);
    const [openedFor, setOpenedFor] = useState(null);


    // Clear the remark when a different revocation is opened.
    if (isOpen && openedFor !== revocation.id) {
        setOpenedFor(revocation.id);
        setRemark("");
    }


    useEffect(() => {

        if (!isOpen) {
            return undefined;
        }

        const onKeyDown = (event) => {

            if (event.key === "Escape") {
                onClose?.();
            }

        };

        const previousOverflow = document.body.style.overflow;

        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", onKeyDown);
        };

    }, [isOpen, onClose]);


    if (!isOpen) {
        return null;
    }


    const reason = getRevocationReason(revocation.reasonCode);

    const requiredRole = REVOCATION_STAGE_ROLE[revocation.status];

    const assignedApprover = revocation.status === REVOCATION_STAGE.SECRETARIAL_REVIEW
        ? revocation.approvers?.secretarial
        : revocation.approvers?.ormdHead;

    const canAct = Boolean(requiredRole) && (
        user?.role === "ADMIN" ||
        (user?.role === requiredRole && assignedApprover === user?.employeeId)
    );


    const handleAction = async (action) => {

        if (action === "REJECT" && !remark.trim()) {
            alert("A remark is required to reject a revocation.");
            return;
        }

        setBusy(true);

        try {

            await onAction(revocation.id, action, remark.trim());

        } catch (error) {

            console.error("Failed to process revocation action:", error);

            alert(
                error.message ||
                "Unable to process this action. Please try again."
            );

        } finally {

            setBusy(false);

        }

    };


    return createPortal(

        <div
            className="checker-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Revocation details"
            onMouseDown={(event) => {

                if (event.target === event.currentTarget) {
                    onClose?.();
                }

            }}
        >

            <div className="checker-modal-card wide revocation-detail-card">

                <div className="modal-header">

                    <h2>
                        <span className="revoke-header-icon">
                            <ShieldOff size={17} />
                        </span>
                        {revocation.id}
                    </h2>

                    <button
                        type="button"
                        className="modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        &times;
                    </button>

                </div>


                <div className="modal-body">


                    <div className="modal-summary">

                        <div>
                            <span>Revocation ID</span>
                            <strong>{revocation.id}</strong>
                        </div>

                        <div>
                            <span>Against Request</span>
                            <strong>{revocation.requestId}</strong>
                        </div>

                        <div>
                            <span>Current Stage</span>
                            <strong>{REVOCATION_STAGE_LABELS[revocation.status]}</strong>
                        </div>

                    </div>


                    <div className="modal-section">

                        <h3>Revocation Reason</h3>

                        <div className="revocation-reason-banner">
                            {reason ? reason.label : revocation.reasonCode}
                        </div>

                        <div className="revocation-grid">

                            <Field
                                label="Initiated By"
                                value={
                                    revocation.initiatedBy?.employeeName
                                        ? `${revocation.initiatedBy.employeeName} (${revocation.initiatedBy.employeeId})`
                                        : revocation.initiatedBy?.employeeId
                                }
                            />

                            <Field label="Initiated On" value={formatDateTime(revocation.createdAt)} />

                            {revocation.dateOfRevocation && (
                                <Field label="Date of Revocation" value={formatDate(revocation.dateOfRevocation)} />
                            )}

                            {revocation.location && (
                                <Field label="Location" value={revocation.location} />
                            )}

                            {revocation.letterLostDate && (
                                <Field label="Letter Lost Date" value={formatDate(revocation.letterLostDate)} />
                            )}

                            {revocation.originalSubmissionConfirmation && (
                                <Field
                                    label="Original AL / POA Submitted"
                                    value={revocation.originalSubmissionConfirmation}
                                />
                            )}

                        </div>

                        <div className="modal-purpose">
                            <span>{reason ? reason.reasonLabel : "Reason"}</span>
                            <p>{revocation.reasonText}</p>
                        </div>

                        {revocation.lossActionTaken && (

                            <div className="modal-purpose">
                                <span>Action taken for loss of original AL / POA</span>
                                <p>{revocation.lossActionTaken}</p>
                            </div>

                        )}

                    </div>


                    <div className="modal-section">

                        <h3>Original Request</h3>

                        <div className="revocation-grid">

                            <Field label="Request ID" value={revocation.request?.id} />
                            <Field label="Letter Type" value={revocation.request?.letterType} />
                            <Field label="Requested For" value={revocation.request?.requestedFor} />
                            <Field label="AL / POA Reference" value={revocation.request?.letterReference} />
                            <Field
                                label="Requestor"
                                value={
                                    revocation.request?.requestor?.employeeName
                                        ? `${revocation.request.requestor.employeeName} (${revocation.request.requestor.employeeId})`
                                        : "-"
                                }
                            />
                            <Field label="Department" value={revocation.request?.department} />
                            <Field label="Initiated Date" value={formatDate(revocation.request?.initiateDate)} />
                            <Field label="Expiry Date" value={formatDate(revocation.request?.expiryDate)} />

                            {revocation.request?.requestedFor === "Third Party" && (
                                <Field label="Vendor Name" value={revocation.request?.vendorName} />
                            )}

                        </div>

                    </div>


                    {revocation.documents?.length > 0 && (

                        <div className="modal-section">

                            <h3>Supporting Documents</h3>

                            <ul className="document-list">

                                {revocation.documents.map((document_) => (

                                    <li key={`${document_.type}-${document_.fileName}`}>

                                        <div className="document-entry">

                                            <span className="revocation-doc-type">
                                                {REVOCATION_DOCUMENT_LABELS[document_.type] || document_.type}
                                            </span>

                                            <span>{document_.fileName}</span>

                                        </div>

                                        <button
                                            type="button"
                                            className="download-letter-button"
                                            onClick={() => downloadDocument(document_)}
                                        >
                                            <Download size={13} />
                                            Download
                                        </button>

                                    </li>

                                ))}

                            </ul>

                        </div>

                    )}


                    <div className="modal-section">

                        <h3>Revocation Trail</h3>

                        <ul className="audit-list">

                            {revocation.audit.map((entry, index) => (

                                <li key={index}>

                                    <div className="audit-line">
                                        <strong>{entry.action}</strong>
                                        <span>{formatDateTime(entry.timestamp)}</span>
                                    </div>

                                    <div className="audit-actor">
                                        {entry.actor} - {entry.role}
                                    </div>

                                    {entry.remark && (
                                        <div className="audit-remark">"{entry.remark}"</div>
                                    )}

                                </li>

                            ))}

                        </ul>

                    </div>


                    {canAct ? (

                        <div className="modal-section action-section">

                            <h3>
                                Take Action - {REVOCATION_STAGE_LABELS[revocation.status]}
                            </h3>

                            <label htmlFor="revocation-remark">
                                Remark (required to reject)
                            </label>

                            <textarea
                                id="revocation-remark"
                                rows="3"
                                value={remark}
                                onChange={(event) => setRemark(event.target.value)}
                                placeholder="Enter remark"
                            />

                            <div className="checker-actions">

                                <button
                                    type="button"
                                    className="action-button tone-reject"
                                    onClick={() => handleAction("REJECT")}
                                    disabled={busy}
                                >
                                    Reject Revocation
                                </button>

                                <button
                                    type="button"
                                    className="action-button tone-approve"
                                    onClick={() => handleAction("APPROVE")}
                                    disabled={busy}
                                >
                                    {revocation.status === REVOCATION_STAGE.ORMD_FINAL
                                        ? "Approve & Revoke"
                                        : "Approve"}
                                </button>

                            </div>

                        </div>

                    ) : (

                        <div className="modal-section action-section">

                            <p className="no-action-note">
                                {requiredRole
                                    ? "This revocation is awaiting another approver - shown here for reference only."
                                    : "This revocation is closed - shown here for reference only."}
                            </p>

                        </div>

                    )}

                </div>

            </div>

        </div>,

        document.body

    );

}


export default RevocationDetailModal;
