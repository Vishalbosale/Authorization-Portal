import {
    useMemo,
    useState
} from "react";


import {
    Link
} from "react-router-dom";


import {
    useAuth
} from "../../context/AuthContext";


import {
    useRequests
} from "../../context/RequestsContext";


import {
    MAKER_CAN_WITHDRAW_STAGES,
    STAGE,
    STAGE_LABELS,
    formatDateTime
} from "../../data/workflow";


import RequestDetailModal from "../../components/RequestDetail/RequestDetail";


import "./MyRequests.css";


// Maps each workflow stage to the tab it belongs to, per the spec's Maker
// portal tab list: Submitted / Pending / Sent Back / Approved / Rejected /
// Withdrawn / Completed.
const STAGE_TAB = {
    [STAGE.HOD_INITIAL]: "SUBMITTED",
    [STAGE.ORMD_REVIEW]: "PENDING",
    [STAGE.COO_ED_REVIEW]: "PENDING",
    [STAGE.REQUESTER_REVISION]: "SENT_BACK",
    [STAGE.SECRETARIAL]: "APPROVED",
    [STAGE.LETTER_ISSUED]: "COMPLETED",
    [STAGE.REJECTED]: "REJECTED",
    [STAGE.WITHDRAWN]: "WITHDRAWN"
};

const TABS = [
    { key: "ALL", label: "My Requests" },
    { key: "SUBMITTED", label: "Submitted" },
    { key: "PENDING", label: "Pending" },
    { key: "SENT_BACK", label: "Sent Back" },
    { key: "APPROVED", label: "Approved" },
    { key: "REJECTED", label: "Rejected" },
    { key: "WITHDRAWN", label: "Withdrawn" },
    { key: "COMPLETED", label: "Completed" }
];


function stageBadgeTone(status) {

    if (status === STAGE.REJECTED || status === STAGE.WITHDRAWN) return "badge-closed";
    if (status === STAGE.REVOKED) return "badge-revoked";
    if (status === STAGE.LETTER_ISSUED) return "badge-secretarial";
    if (status === STAGE.REQUESTER_REVISION) return "badge-sentback";

    return "badge-default";

}


const EXPORT_COLUMNS = [
    { header: "Request ID", value: (request) => request.id },
    { header: "Maker Employee ID", value: (request) => request.requestor?.employeeId },
    { header: "Maker Name", value: (request) => request.requestor?.employeeName },
    { header: "Maker Department", value: (request) => request.requestor?.department },
    { header: "Maker Designation", value: (request) => request.requestor?.designation },
    { header: "Letter Type", value: (request) => request.letterType },
    { header: "Requested For", value: (request) => request.requestedFor },
    { header: "Requested For Employee ID", value: (request) => request.requestedForEmployeeId },
    { header: "Department", value: (request) => request.department },
    { header: "Designation", value: (request) => request.designation },
    { header: "Initiate Date", value: (request) => request.initiateDate },
    { header: "Expiry Date", value: (request) => request.expiryDate },
    { header: "Purpose", value: (request) => request.purpose },
    { header: "Remark", value: (request) => request.remark },
    { header: "Vendor Name", value: (request) => request.vendorName },
    { header: "Third Party ID", value: (request) => request.thirdPartyId },
    { header: "KYC Document", value: (request) => request.documents?.[0] },
    { header: "Due Diligence Document", value: (request) => request.documents?.[1] },
    { header: "HOD Approver ID", value: (request) => request.approvers?.hod },
    { header: "ORMD Head Approver ID", value: (request) => request.approvers?.ormdHead },
    { header: "COO / ED Approver ID", value: (request) => request.approvers?.cooEd },
    { header: "Secretarial Approver ID", value: (request) => request.approvers?.secretarial },
    { header: "Status", value: (request) => STAGE_LABELS[request.status] || request.status },
    { header: "Created At", value: (request) => formatDateTime(request.createdAt) },
    { header: "Last Updated At", value: (request) => formatDateTime(request.updatedAt) },
    {
        header: "Request Close / Reject At",
        value: (request) => {
            const closingEntry = [...(request.audit || [])]
                .reverse()
                .find((entry) => [STAGE.REJECTED, STAGE.WITHDRAWN].includes(entry.toStage));

            return closingEntry ? formatDateTime(closingEntry.timestamp) : "";
        }
    }
];


function escapeCsvField(value) {

    return `"${String(value ?? "").replace(/"/g, '""')}"`;

}


function getExportColumns(requests) {

    return EXPORT_COLUMNS.filter((column) =>
        column.header === "Request ID" ||
        column.header === "Maker Employee ID" ||
        column.header === "Maker Name" ||
        column.header === "Status" ||
        column.header === "Created At" ||
        column.header === "Last Updated At" ||
        column.header === "Request Close / Reject At" ||
        requests.some((request) => String(column.value(request) ?? "").trim())
    );

}


function buildCsv(requests, columns) {

    const headerRow = columns.map((column) => escapeCsvField(column.header)).join(",");
    const rows = requests.map((request) =>
        columns.map((column) => escapeCsvField(column.value(request))).join(",")
    );

    return [headerRow, ...rows].join("\r\n");

}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

}


function buildExcelHtml(requests, columns) {

    const headers = columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join("");
    const rows = requests.map((request) => {
        const cells = columns.map((column) => `<td>${escapeHtml(column.value(request))}</td>`).join("");
        return `<tr>${cells}</tr>`;
    }).join("");

    return `<html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></body></html>`;

}


function MyRequests() {

    const { user } =
        useAuth();

    const {
        requests,
        withdrawRequest
    } = useRequests();


    const [
        activeTab,
        setActiveTab
    ] = useState("ALL");

    const [
        selectedRequest,
        setSelectedRequest
    ] = useState(null);

    const [
        withdrawRemark,
        setWithdrawRemark
    ] = useState("");

    const [
        searchTerm,
        setSearchTerm
    ] = useState("");

    const [
        exportFormat,
        setExportFormat
    ] = useState("csv");


    const myRequests = useMemo(() => {

        return requests
            .filter((request) => request.requestor?.employeeId === user.employeeId)
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    }, [requests, user.employeeId]);


    const tabCounts = useMemo(() => {

        const counts = { ALL: myRequests.length };

        TABS.forEach((tab) => {
            if (tab.key !== "ALL") counts[tab.key] = 0;
        });

        myRequests.forEach((request) => {
            const tabKey = STAGE_TAB[request.status];
            if (tabKey) counts[tabKey] = (counts[tabKey] || 0) + 1;
        });

        return counts;

    }, [myRequests]);


    const visibleRequests = activeTab === "ALL"
        ? myRequests
        : myRequests.filter((request) => STAGE_TAB[request.status] === activeTab);

    const searchedRequests = visibleRequests.filter((request) =>
        request.id.toLowerCase().includes(searchTerm.trim().toLowerCase())
    );

    const handleExport = () => {

        const isExcel = exportFormat === "excel";
        const exportColumns = getExportColumns(searchedRequests);
        const content = isExcel
            ? buildExcelHtml(searchedRequests, exportColumns)
            : "\ufeff" + buildCsv(searchedRequests, exportColumns);
        const blob = new Blob([content], {
            type: isExcel ? "application/vnd.ms-excel;charset=utf-8;" : "text/csv;charset=utf-8;"
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `my_requests_${new Date().toISOString().slice(0, 10)}.${isExcel ? "xls" : "csv"}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    };


    const openRequest = (request) => {

        setSelectedRequest(request);
        setWithdrawRemark("");

    };


    const closeRequest = () => {

        setSelectedRequest(null);
        setWithdrawRemark("");

    };


    const handleWithdraw = async () => {

        if (!selectedRequest) return;

        try {

            await withdrawRequest(
                selectedRequest.id,
                `${user.employeeName} (${user.employeeId})`,
                withdrawRemark.trim()
            );

            closeRequest();

        } catch (error) {

            console.error("Failed to withdraw request:", error);

            alert(
                error.message ||
                "Unable to withdraw this request. Please try again."
            );

        }

    };


    const canWithdraw = selectedRequest &&
        MAKER_CAN_WITHDRAW_STAGES.includes(selectedRequest.status);

    const isSentBack = selectedRequest?.status === STAGE.REQUESTER_REVISION;


    return (

        <div className="my-requests-page">


            <div className="page-heading">

                <h1>
                    My Requests
                </h1>

                <p>
                    Track every request you have raised, from submission
                    through to the final AL / POA letter.
                </p>

            </div>


            {myRequests.some((request) => request.status === STAGE.REQUESTER_REVISION) && (

                <div className="maker-returned-panel">

                    <h2>
                        Requester Bucket - Sent Back for Correction
                    </h2>

                    <p>
                        These requests need your correction. After resubmission,
                        each request will return directly to the approver's bucket
                        that sent it back.
                    </p>

                    {myRequests
                        .filter((request) => request.status === STAGE.REQUESTER_REVISION)
                        .map((request) => {

                            const lastRemark = [...(request.audit || [])]
                                .reverse()
                                .find((entry) => entry.toStage === STAGE.REQUESTER_REVISION);

                            return (

                                <div className="maker-returned-item" key={request.id}>

                                    <strong>{request.id}</strong>

                                    <span>
                                        Sent back by {lastRemark?.actor || "the approver"}.
                                        Resubmission returns to {STAGE_LABELS[request.returnStage] || "the same approver's bucket"}.
                                    </span>

                                </div>

                            );

                        })}

                </div>

            )}


            <div className="history-tabs">

                {TABS.map((tab) => (

                    <button
                        key={tab.key}
                        type="button"
                        className={tab.key === activeTab ? "history-tab active" : "history-tab"}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                        <span className="tab-count">({tabCounts[tab.key] || 0})</span>
                    </button>

                ))}

            </div>


            <div className="request-list-toolbar">

                <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by ticket ID"
                    aria-label="Search by ticket ID"
                />

                <div className="export-buttons">

                    <select
                        value={exportFormat}
                        onChange={(event) => setExportFormat(event.target.value)}
                        aria-label="Export format"
                    >
                        <option value="csv">CSV</option>
                        <option value="excel">Excel</option>
                    </select>

                    <button type="button" className="export-button" onClick={handleExport} disabled={searchedRequests.length === 0}>
                        Export Tickets
                    </button>

                </div>

            </div>


            <div className="checker-table-container">

                <table>

                    <thead>

                        <tr>

                            <th>Request ID</th>
                            <th>Letter Type</th>
                            <th>Requested For</th>
                            <th>Purpose</th>
                            <th>Current Bucket</th>
                            <th>Last Updated</th>
                            <th>Action</th>

                        </tr>

                    </thead>


                    <tbody>

                        {searchedRequests.length === 0 && (

                            <tr>
                                <td colSpan={7} className="empty-row">
                                    No requests in this view.
                                </td>
                            </tr>

                        )}

                        {searchedRequests.map((request) => (

                            <tr key={request.id}>

                                <td>{request.id}</td>

                                <td>{request.letterType}</td>

                                <td>{request.requestedFor}</td>

                                <td className="purpose-cell">{request.purpose}</td>

                                <td>

                                    <span className={`stage-badge ${stageBadgeTone(request.status)}`}>
                                        {STAGE_LABELS[request.status]}
                                    </span>

                                </td>

                                <td>{formatDateTime(request.updatedAt)}</td>

                                <td>

                                    <button
                                        className="review-button"
                                        onClick={() => openRequest(request)}
                                    >
                                        View
                                    </button>

                                </td>

                            </tr>

                        ))}

                    </tbody>

                </table>

            </div>


            <RequestDetailModal
                request={selectedRequest}
                onClose={closeRequest}
                title="My Request"
            >

                {selectedRequest && (

                    <div className="modal-section action-section">

                        {isSentBack && (

                            <div className="sent-back-callout">

                                <p>
                                    This request was sent back for correction.
                                    Go to the Request page to edit and
                                    resubmit it - it will return directly to
                                    whoever sent it back.
                                </p>

                                <Link to="/request" className="action-button tone-approve">
                                    Go to Request Page
                                </Link>

                            </div>

                        )}

                        {canWithdraw ? (

                            <>

                                <h3>Withdraw This Request</h3>

                                <label>Withdrawal Remark (optional)</label>

                                <textarea
                                    rows="3"
                                    value={withdrawRemark}
                                    onChange={(e) => setWithdrawRemark(e.target.value)}
                                    placeholder="Reason for withdrawing (optional)"
                                />

                                <div className="checker-actions">

                                    <button
                                        className="action-button tone-withdraw"
                                        onClick={handleWithdraw}
                                    >
                                        Withdraw Request
                                    </button>

                                </div>

                            </>

                        ) : (

                            !isSentBack && (

                                <p className="no-action-note">
                                    This request is closed and can no longer
                                    be withdrawn or edited.
                                </p>

                            )

                        )}

                    </div>

                )}

            </RequestDetailModal>

        </div>

    );

}


export default MyRequests;
