import {
    useEffect
} from "react";


import {
    createPortal
} from "react-dom";


import {
    STAGE_LABELS,
    formatDateTime
} from "../../data/workflow";


import "./RequestDetail.css";


function escapeHtml(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function downloadDocument(documentData, fallbackName) {

    if (documentData) {

        const link = document.createElement("a");
        link.href = documentData.data;
        link.download = documentData.fileName || fallbackName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        return;

    }

}


function downloadIssuedLetter(request) {

    if (request.letterDocumentData) {

        downloadDocument(
            { data: request.letterDocumentData, fileName: request.letterDocument },
            "issued-letter"
        );

        return;

    }

    const content = `<!doctype html>
<html><head><meta charset="utf-8"><title>Issued Letter ${escapeHtml(request.letterReference)}</title></head>
<body><h1>Issued AL / POA Letter</h1>
<p><strong>Reference:</strong> ${escapeHtml(request.letterReference)}</p>
<p><strong>Request ID:</strong> ${escapeHtml(request.id)}</p>
<p><strong>Requestor:</strong> ${escapeHtml(request.requestor?.employeeName)} (${escapeHtml(request.requestor?.employeeId)})</p>
<p><strong>Letter Type:</strong> ${escapeHtml(request.letterType)}</p>
<p><strong>Purpose:</strong> ${escapeHtml(request.purpose)}</p>
<p><strong>Initiate Date:</strong> ${escapeHtml(request.initiateDate)}</p>
<p><strong>Expiry Date:</strong> ${escapeHtml(request.expiryDate)}</p>
</body></html>`;

    const blob = new Blob([content], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const filename = `${request.letterReference || request.id || "issued-letter"}.html`;
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

}


// Shared read-only request detail view used inside a modal: summary,
// requester info, request info, documents, and the full audit trail.
// Callers pass role-specific actions (approve/reject buttons, a withdraw
// button, or nothing at all for a pure read-only view) as children.
function RequestDetailModal({
    request,
    onClose,
    title = "Request Details",
    children
}) {

    const isOpen = Boolean(request);


    // Close on Escape, and stop the page behind the overlay from scrolling.
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


    // Rendered on document.body: the route wrapper animates with a transform,
    // which creates a stacking context that would otherwise trap this overlay
    // beneath the sticky header and the footer.
    return createPortal(

        <div
            className="checker-modal"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onMouseDown={(event) => {

                if (event.target === event.currentTarget) {
                    onClose?.();
                }

            }}
        >

            <div className="checker-modal-card wide">

                <div className="modal-header">

                    <h2>
                        {title}
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
                        <span>Request ID</span>
                        <strong>{request.id}</strong>
                    </div>

                    <div>
                        <span>Current Status</span>
                        <strong>{STAGE_LABELS[request.status]}</strong>
                    </div>

                    <div>
                        <span>Letter Type</span>
                        <strong>{request.letterType}</strong>
                    </div>

                </div>


                <div className="modal-section">

                    <h3>Requester Details</h3>

                    <div className="modal-grid">

                        <div>
                            <span>Name</span>
                            <strong>{request.requestor?.employeeName}</strong>
                        </div>

                        <div>
                            <span>Employee ID</span>
                            <strong>{request.requestor?.employeeId}</strong>
                        </div>

                        <div>
                            <span>Department</span>
                            <strong>{request.requestor?.department}</strong>
                        </div>

                        <div>
                            <span>Designation</span>
                            <strong>{request.requestor?.designation || "-"}</strong>
                        </div>

                    </div>

                </div>


                <div className="modal-section">

                    <h3>Request Details</h3>

                    <div className="modal-grid">

                        <div>
                            <span>Requested For</span>
                            <strong>
                                {request.requestedFor}
                                {request.requestedFor === "Others" && request.requestedForEmployeeId
                                    ? ` (${request.requestedForEmployeeId})`
                                    : ""}
                            </strong>
                        </div>

                        <div>
                            <span>Department</span>
                            <strong>{request.department}</strong>
                        </div>

                        <div>
                            <span>Initiate Date</span>
                            <strong>{request.initiateDate}</strong>
                        </div>

                        <div>
                            <span>Expiry Date</span>
                            <strong>{request.expiryDate}</strong>
                        </div>

                        {request.requestedFor === "Third Party" && (

                            <>

                                <div>
                                    <span>Vendor Name</span>
                                    <strong>{request.vendorName}</strong>
                                </div>

                                <div>
                                    <span>Third Party ID</span>
                                    <strong>{request.thirdPartyId}</strong>
                                </div>

                            </>

                        )}

                    </div>

                    <div className="modal-purpose">
                        <span>Purpose</span>
                        <p>{request.purpose}</p>
                    </div>

                </div>


                {request.documents?.length > 0 && (

                    <div className="modal-section">

                        <h3>Supporting Documents</h3>

                        <ul className="document-list">

                            {request.documents.map((doc, index) => {
                                const attachment = request.documentAttachments?.[index];
                                const canDownload = ["KYC", "DUE_DILIGENCE"].includes(attachment?.type);

                                return (
                                <li key={doc}>
                                    <div className="document-entry">
                                        <span>{doc}</span>
                                        {canDownload && (
                                        <button
                                            type="button"
                                            className="download-letter-button"
                                            onClick={() => downloadDocument(attachment, doc)}
                                        >
                                            Download
                                        </button>
                                        )}
                                    </div>
                                    {attachment?.uploadedAt && (
                                        <time>{formatDateTime(attachment.uploadedAt)}</time>
                                    )}
                                </li>
                                );
                            })}

                        </ul>

                    </div>

                )}


                {request.letterReference && (

                    <div className="modal-section">

                        <h3>Issued Letter</h3>

                        <div className="modal-grid">

                            <div>
                                <span>Reference</span>
                                <strong>{request.letterReference}</strong>
                            </div>

                            {request.letterDocument && (

                                <div>
                                    <span>Attached Document</span>
                                    <strong>{request.letterDocument}</strong>
                                    <button
                                        type="button"
                                        className="download-letter-button"
                                        onClick={() => downloadIssuedLetter(request)}
                                    >
                                        Download Document
                                    </button>
                                </div>

                            )}

                        </div>

                    </div>

                )}


                <div className="modal-section">

                    <h3>Audit Trail</h3>

                    <ul className="audit-list">

                        {request.audit.map((entry, index) => (

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


                {children}


                </div>

            </div>

        </div>,

        document.body

    );

}


export default RequestDetailModal;
