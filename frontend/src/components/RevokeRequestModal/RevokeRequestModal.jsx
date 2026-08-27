import {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    createPortal
} from "react-dom";

import {
    AlertCircle,
    FileUp,
    Paperclip,
    ShieldOff
} from "lucide-react";

import {
    ORIGINAL_SUBMISSION_OPTIONS,
    getRevocationReason,
    getRevocationReasonsFor,
    validateRevocationForm
} from "../../data/revocation";

import "./RevokeRequestModal.css";


const API_URL = "/api";

const EMPTY_FORM = {
    reasonCode: "",
    reasonText: "",
    dateOfRevocation: "",
    letterLostDate: "",
    location: "",
    originalSubmissionConfirmation: "",
    lossActionTaken: "",
    documents: {},
    approvers: { secretarial: "", ormdHead: "" }
};


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


// Read-only context pulled from the request being revoked. Per the spec these
// details already exist in the backend and are reflected against the request
// rather than re-entered.
function PrefilledField({ label, value }) {

    return (

        <div className="revoke-prefilled-field">
            <span>{label}</span>
            <strong>{value || "-"}</strong>
        </div>

    );

}


function RevokeRequestModal({ request, onClose, onSubmit }) {

    const isOpen = Boolean(request);

    const [form, setForm] = useState(EMPTY_FORM);
    const [approverOptions, setApproverOptions] = useState({ SECRETARIAL: [], ORMD_HEAD: [] });
    const [problems, setProblems] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [openedFor, setOpenedFor] = useState(null);

    const reason = getRevocationReason(form.reasonCode);

    const availableReasons = useMemo(() => {

        if (!request) {
            return [];
        }

        return getRevocationReasonsFor(request.requestedFor);

    }, [request]);


    // Reset whenever a different request is opened. Adjusting during render
    // rather than in an effect avoids a first paint showing the previous
    // request's answers.
    if (isOpen && openedFor !== request.id) {
        setOpenedFor(request.id);
        setForm(EMPTY_FORM);
        setProblems([]);
        setSubmitting(false);
    }


    useEffect(() => {

        if (!isOpen) {
            return;
        }

        fetch(`${API_URL}/api/employees/approvers`, { credentials: "include" })
            .then((response) => response.json())
            .then((body) => {

                if (body.data) {
                    setApproverOptions(body.data);
                }

            })
            .catch((error) => console.error("Failed to load approvers:", error));

    }, [isOpen]);


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


    const setField = (name, value) => {

        setForm((previous) => ({ ...previous, [name]: value }));

    };


    const handleReasonChange = (code) => {

        // Reason drives which fields exist, so clear anything the previous
        // reason collected rather than submitting stale values.
        setForm((previous) => ({
            ...EMPTY_FORM,
            reasonCode: code,
            approvers: previous.approvers
        }));

        setProblems([]);

    };


    const handleFile = (documentType, file) => {

        if (!file) {
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {

            setForm((previous) => ({
                ...previous,
                documents: {
                    ...previous.documents,
                    [documentType]: {
                        fileName: file.name,
                        data: String(reader.result || "")
                    }
                }
            }));

        };

        reader.readAsDataURL(file);

    };


    const handleSubmit = async (event) => {

        event.preventDefault();

        const found = validateRevocationForm(reason, form);

        if (found.length > 0) {
            setProblems(found);
            return;
        }

        setProblems([]);
        setSubmitting(true);

        try {

            await onSubmit({
                requestId: request.id,
                ...form
            });

        } catch (error) {

            setProblems([
                error.message || "Unable to submit this revocation. Please try again."
            ]);

        } finally {

            setSubmitting(false);

        }

    };


    return createPortal(

        <div
            className="checker-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Revoke request"
            onMouseDown={(event) => {

                if (event.target === event.currentTarget) {
                    onClose?.();
                }

            }}
        >

            <div className="checker-modal-card wide revoke-modal-card">

                <div className="modal-header">

                    <h2>
                        <span className="revoke-header-icon">
                            <ShieldOff size={17} />
                        </span>
                        Revoke {request.id}
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


                <form className="modal-body" onSubmit={handleSubmit}>


                    {/* ---------- Existing request details ---------- */}

                    <div className="modal-section">

                        <h3>Request Details</h3>

                        <p className="revoke-hint">
                            Read from the issued request - these cannot be edited here.
                        </p>

                        <div className="revoke-prefilled-grid">

                            <PrefilledField label="Requested For" value={request.requestedFor} />
                            <PrefilledField label="Status" value="Letter Issued" />
                            <PrefilledField label="Letter Type" value={request.letterType} />
                            <PrefilledField label="AL / POA Reference" value={request.letterReference} />
                            <PrefilledField
                                label="Employee Name"
                                value={request.requestor?.employeeName}
                            />
                            <PrefilledField label="Initiated Date" value={formatDate(request.initiateDate)} />
                            <PrefilledField label="Department" value={request.department} />
                            <PrefilledField label="Expiry Date" value={formatDate(request.expiryDate)} />

                            {request.requestedFor === "Third Party" && (
                                <PrefilledField label="Vendor Name" value={request.vendorName} />
                            )}

                        </div>

                    </div>


                    {/* ---------- Reason ---------- */}

                    <div className="modal-section">

                        <h3>Revocation Reason</h3>

                        <div className="revoke-field">

                            <label htmlFor="revoke-reason-code">
                                Reason for Revocation *
                            </label>

                            <select
                                id="revoke-reason-code"
                                value={form.reasonCode}
                                onChange={(event) => handleReasonChange(event.target.value)}
                                required
                            >

                                <option value="">Select a reason</option>

                                {availableReasons.map((option) => (
                                    <option key={option.code} value={option.code}>
                                        {option.label}
                                    </option>
                                ))}

                            </select>

                        </div>


                        {reason && (

                            <div className="revoke-reason-fields">

                                <div className="revoke-field-grid">

                                    {reason.fields.includes("dateOfRevocation") && (

                                        <div className="revoke-field">
                                            <label htmlFor="revoke-date">Date of Revocation *</label>
                                            <input
                                                id="revoke-date"
                                                type="date"
                                                value={form.dateOfRevocation}
                                                onChange={(event) => setField("dateOfRevocation", event.target.value)}
                                            />
                                            <span className="revoke-field-hint">
                                                Last working day or contract expiry date
                                            </span>
                                        </div>

                                    )}

                                    {reason.fields.includes("location") && (

                                        <div className="revoke-field">
                                            <label htmlFor="revoke-location">Location *</label>
                                            <input
                                                id="revoke-location"
                                                type="text"
                                                value={form.location}
                                                onChange={(event) => setField("location", event.target.value)}
                                                placeholder="Where the letter was lost"
                                            />
                                        </div>

                                    )}

                                    {reason.fields.includes("letterLostDate") && (

                                        <div className="revoke-field">
                                            <label htmlFor="revoke-lost-date">Letter Lost Date *</label>
                                            <input
                                                id="revoke-lost-date"
                                                type="date"
                                                value={form.letterLostDate}
                                                onChange={(event) => setField("letterLostDate", event.target.value)}
                                            />
                                        </div>

                                    )}

                                    {reason.fields.includes("originalSubmissionConfirmation") && (

                                        <div className="revoke-field">
                                            <label htmlFor="revoke-confirmation">
                                                Confirmation of submission of original AL / POA *
                                            </label>
                                            <select
                                                id="revoke-confirmation"
                                                value={form.originalSubmissionConfirmation}
                                                onChange={(event) =>
                                                    setField("originalSubmissionConfirmation", event.target.value)
                                                }
                                            >
                                                <option value="">Select</option>
                                                {ORIGINAL_SUBMISSION_OPTIONS.map((option) => (
                                                    <option key={option} value={option}>{option}</option>
                                                ))}
                                            </select>
                                        </div>

                                    )}

                                </div>


                                <div className="revoke-field">

                                    <label htmlFor="revoke-reason-text">
                                        {reason.reasonLabel} *
                                    </label>

                                    <textarea
                                        id="revoke-reason-text"
                                        rows="3"
                                        value={form.reasonText}
                                        onChange={(event) => setField("reasonText", event.target.value)}
                                        placeholder={reason.reasonPlaceholder}
                                    />

                                </div>


                                {reason.fields.includes("lossActionTaken") && (

                                    <div className="revoke-field">

                                        <label htmlFor="revoke-loss-action">
                                            Action taken for loss of original AL / POA *
                                        </label>

                                        <textarea
                                            id="revoke-loss-action"
                                            rows="3"
                                            value={form.lossActionTaken}
                                            onChange={(event) => setField("lossActionTaken", event.target.value)}
                                            placeholder="Describe the action taken"
                                        />

                                    </div>

                                )}

                            </div>

                        )}

                    </div>


                    {/* ---------- Documents ---------- */}

                    {reason && reason.documents.length > 0 && (

                        <div className="modal-section">

                            <h3>Supporting Documents</h3>

                            <div className="revoke-upload-grid">

                                {reason.documents.map((document) => {

                                    const uploaded = form.documents[document.type];

                                    return (

                                        <div className="revoke-upload" key={document.type}>

                                            <label htmlFor={`revoke-file-${document.type}`}>
                                                {document.label} *
                                            </label>

                                            {document.hint && (
                                                <span className="revoke-field-hint">{document.hint}</span>
                                            )}

                                            <input
                                                id={`revoke-file-${document.type}`}
                                                type="file"
                                                accept=".pdf,.zip"
                                                onChange={(event) =>
                                                    handleFile(document.type, event.target.files?.[0])
                                                }
                                            />

                                            <span className="revoke-upload-note">
                                                <FileUp size={13} />
                                                Accepted: PDF, ZIP. Max 10 MB per file.
                                            </span>

                                            {uploaded && (
                                                <span className="revoke-upload-file">
                                                    <Paperclip size={13} />
                                                    {uploaded.fileName}
                                                </span>
                                            )}

                                        </div>

                                    );

                                })}

                            </div>

                        </div>

                    )}


                    {/* ---------- Approvers ---------- */}

                    <div className="modal-section">

                        <h3>Select Approver</h3>

                        <p className="revoke-hint">
                            A revocation goes to Secretarial for approval, then to the
                            ORMD Head for final approval.
                        </p>

                        <div className="revoke-field-grid">

                            <div className="revoke-field">

                                <label htmlFor="revoke-approver-secretarial">
                                    Secretarial - Approval *
                                </label>

                                <select
                                    id="revoke-approver-secretarial"
                                    value={form.approvers.secretarial}
                                    onChange={(event) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            approvers: { ...previous.approvers, secretarial: event.target.value }
                                        }))
                                    }
                                >
                                    <option value="">Select Secretarial approver</option>
                                    {approverOptions.SECRETARIAL.map((approver) => (
                                        <option key={approver.employeeId} value={approver.employeeId}>
                                            {approver.employeeName} - {approver.employeeId}
                                        </option>
                                    ))}
                                </select>

                            </div>


                            <div className="revoke-field">

                                <label htmlFor="revoke-approver-ormd">
                                    ORMD Head - Final Approval *
                                </label>

                                <select
                                    id="revoke-approver-ormd"
                                    value={form.approvers.ormdHead}
                                    onChange={(event) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            approvers: { ...previous.approvers, ormdHead: event.target.value }
                                        }))
                                    }
                                >
                                    <option value="">Select ORMD Head approver</option>
                                    {approverOptions.ORMD_HEAD.map((approver) => (
                                        <option key={approver.employeeId} value={approver.employeeId}>
                                            {approver.employeeName} - {approver.employeeId}
                                        </option>
                                    ))}
                                </select>

                            </div>

                        </div>

                    </div>


                    {problems.length > 0 && (

                        <div className="revoke-problems" role="alert">

                            <AlertCircle size={16} />

                            <ul>
                                {problems.map((problem) => (
                                    <li key={problem}>{problem}</li>
                                ))}
                            </ul>

                        </div>

                    )}


                    <div className="checker-actions">

                        <button
                            type="button"
                            className="cancel-button"
                            onClick={onClose}
                            disabled={submitting}
                        >
                            Close
                        </button>

                        <button
                            type="submit"
                            className="action-button tone-reject"
                            disabled={submitting}
                        >
                            {submitting ? (
                                <>
                                    <span className="spinner" />
                                    Submitting...
                                </>
                            ) : "Submit Revocation"}
                        </button>

                    </div>

                </form>

            </div>

        </div>,

        document.body

    );

}


export default RevokeRequestModal;
