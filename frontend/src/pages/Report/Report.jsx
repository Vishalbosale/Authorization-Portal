import {
    useMemo,
    useRef,
    useState
} from "react";


import {
    useAuth
} from "../../context/AuthContext";


import {
    useRequests
} from "../../context/RequestsContext";


import RequestDetailModal from "../../components/RequestDetail/RequestDetail";


import {
    ROLE_BUCKETS,
    ROLE_LABELS,
    STAGE,
    STAGE_LABELS,
    TERMINAL_STAGES,
    TIMELINE_STEP_LABELS,
    formatDateTime
} from "../../data/workflow";


import "./Report.css";


function latestAuditByRole(request, roleLabel) {

    const matches = request.audit.filter((entry) => entry.role === roleLabel);

    return matches.length > 0 ? matches[matches.length - 1] : null;

}


function formatActionAndDate(entry) {

    if (!entry) return "";

    return `${entry.action} - ${formatDateTime(entry.timestamp)}`;

}


const EXPORT_COLUMNS = [
    { header: "Request ID", value: (r) => r.id },
    { header: "Request Type", value: (r) => r.letterType },
    { header: "Maker", value: (r) => `${r.requestor?.employeeName || ""} (${r.requestor?.employeeId || ""})` },
    { header: "Department", value: (r) => r.department },
    { header: "Submission Date", value: (r) => formatDateTime(r.createdAt) },
    { header: "Current Stage", value: (r) => TIMELINE_STEP_LABELS[r.status] || STAGE_LABELS[r.status] || r.status },
    { header: "Current Bucket", value: (r) => STAGE_LABELS[r.status] || r.status },
    { header: "Current Status", value: (r) => STAGE_LABELS[r.status] || r.status },
    { header: "HOD Action and Date", value: (r) => formatActionAndDate(latestAuditByRole(r, "HOD")) },
    { header: "ORMD Action and Date", value: (r) => formatActionAndDate(latestAuditByRole(r, "ORMD Head")) },
    { header: "COO/ED Action and Date", value: (r) => formatActionAndDate(latestAuditByRole(r, "COO / ED")) },
    {
        header: "Secretarial",
        value: (r) => {
            const entry = latestAuditByRole(r, "Secretarial");
            return entry ? entry.actor : "";
        }
    },
    {
        header: "Letter Issued Date",
        value: (r) => {
            const entry = latestAuditByRole(r, "Secretarial");
            return entry && entry.action === "Letter Issued" ? formatDateTime(entry.timestamp) : "";
        }
    },
    {
        header: "Final Status",
        value: (r) => TERMINAL_STAGES.includes(r.status) ? STAGE_LABELS[r.status] : "In Progress"
    }
];


function escapeCsvField(value) {

    const stringValue = value === null || value === undefined ? "" : String(value);

    if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;

}


function buildCsv(requests) {

    const headerRow = EXPORT_COLUMNS.map((column) => escapeCsvField(column.header)).join(",");

    const dataRows = requests.map((request) =>
        EXPORT_COLUMNS.map((column) => escapeCsvField(column.value(request))).join(",")
    );

    return [headerRow, ...dataRows].join("\r\n");

}


function escapeHtml(value) {

    const stringValue = value === null || value === undefined ? "" : String(value);

    return stringValue
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

}


function buildExcelHtml(requests) {

    const headerCells = EXPORT_COLUMNS.map((column) => `<th>${escapeHtml(column.header)}</th>`).join("");

    const rows = requests.map((request) => {

        const cells = EXPORT_COLUMNS.map((column) => `<td>${escapeHtml(column.value(request))}</td>`).join("");

        return `<tr>${cells}</tr>`;

    }).join("");

    return `<html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table></body></html>`;

}


function downloadFile(content, filename, mimeType) {

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

}


const EMPTY_FILTERS = {
    status: "ALL",
    dateFrom: "",
    dateTo: "",
    employeeId: ""
};


function Report() {

    const { user } =
        useAuth();

    const { requests } =
        useRequests();


    const [
        filters,
        setFilters
    ] = useState(EMPTY_FILTERS);

    const [
        exportFormat,
        setExportFormat
    ] = useState("csv");

    const [
        searchTerm,
        setSearchTerm
    ] = useState("");

    const [
        selectedRequest,
        setSelectedRequest
    ] = useState(null);

    const reportTableRef = useRef(null);


    const isAdmin = user.role === "ADMIN";

    const isTierChecker = Boolean(ROLE_BUCKETS[user.role]);

    const tierLabel = ROLE_LABELS[user.role];

    const actorString = `${user.employeeName} (${user.employeeId})`;


    // Role-based scoping, per spec: Maker sees own requests, a Checker sees
    // requests currently in their bucket plus ones they have actioned,
    // Admin sees everything.
    const scopedRequests = useMemo(() => {

        if (isAdmin) {
            return requests;
        }

        if (isTierChecker) {

            const bucketStages = ROLE_BUCKETS[user.role] || [];

            return requests.filter((request) =>
                bucketStages.includes(request.status) ||
                request.audit.some((entry) => entry.role === tierLabel && entry.actor === actorString)
            );

        }

        // MAKER (or any other non-checker, non-admin role)
        return requests.filter((request) => request.requestor?.employeeId === user.employeeId);

    }, [requests, isAdmin, isTierChecker, user.role, user.employeeId, tierLabel, actorString]);


    const queueRequests = useMemo(() => {

        if (!isTierChecker) {
            return scopedRequests;
        }

        const bucketStages = ROLE_BUCKETS[user.role] || [];

        return requests.filter((request) => bucketStages.includes(request.status));

    }, [requests, scopedRequests, isTierChecker, user.role]);


    const dateFilteredRequests = useMemo(() => {

        return scopedRequests.filter((request) => {

            if (filters.dateFrom && request.createdAt < filters.dateFrom) {
                return false;
            }

            if (filters.dateTo && request.createdAt > `${filters.dateTo}T23:59:59`) {
                return false;
            }

            return true;

        }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    }, [scopedRequests, filters.dateFrom, filters.dateTo]);


    const queueDateFilteredRequests = useMemo(() => {

        return queueRequests.filter((request) => {

            if (filters.dateFrom && request.createdAt < filters.dateFrom) {
                return false;
            }

            if (filters.dateTo && request.createdAt > `${filters.dateTo}T23:59:59`) {
                return false;
            }

            return true;

        }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    }, [queueRequests, filters.dateFrom, filters.dateTo]);


    const filteredRequests = useMemo(() => {

        return dateFilteredRequests.filter((request) => {

            if (searchTerm.trim() && !request.id.toLowerCase().includes(searchTerm.trim().toLowerCase())) {
                return false;
            }

            if (filters.employeeId.trim() && !request.requestor?.employeeId.toLowerCase().includes(filters.employeeId.trim().toLowerCase())) {
                return false;
            }

            if (filters.status === "IN_PROGRESS") {
                return !TERMINAL_STAGES.includes(request.status);
            }

            if (filters.status === "CLOSED") {
                return [STAGE.REJECTED, STAGE.WITHDRAWN].includes(request.status);
            }

            return filters.status === "ALL" || request.status === filters.status;

        });

    }, [dateFilteredRequests, filters.status, filters.employeeId, searchTerm]);


    const exportRequests = useMemo(() => {

        return queueDateFilteredRequests.filter((request) => {

            if (searchTerm.trim() && !request.id.toLowerCase().includes(searchTerm.trim().toLowerCase())) {
                return false;
            }

            if (filters.employeeId.trim() && !request.requestor?.employeeId.toLowerCase().includes(filters.employeeId.trim().toLowerCase())) {
                return false;
            }

            if (filters.status === "IN_PROGRESS") {
                return !TERMINAL_STAGES.includes(request.status);
            }

            if (filters.status === "CLOSED") {
                return [STAGE.REJECTED, STAGE.WITHDRAWN].includes(request.status);
            }

            return filters.status === "ALL" || request.status === filters.status;

        });

    }, [queueDateFilteredRequests, filters.status, filters.employeeId, searchTerm]);


    const stats = useMemo(() => {

        const total = dateFilteredRequests.length;

        const issued = dateFilteredRequests.filter((r) => r.status === STAGE.LETTER_ISSUED).length;
        const rejected = dateFilteredRequests.filter((r) => r.status === STAGE.REJECTED).length;
        const withdrawn = dateFilteredRequests.filter((r) => r.status === STAGE.WITHDRAWN).length;
        const inProgress = total - issued - rejected - withdrawn;

        return { total, issued, rejected, withdrawn, inProgress };

    }, [dateFilteredRequests]);


    const handleFilterChange = (field, value) => {

        setFilters((previous) => ({ ...previous, [field]: value }));

    };


    const handleSummaryCardClick = (status) => {

        setFilters((previous) => ({ ...previous, status }));

        reportTableRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    };


    const handleResetFilters = () => {

        setFilters(EMPTY_FILTERS);

    };


    const handleExportCsv = () => {

        const timestamp = new Date().toISOString().slice(0, 10);

        downloadFile(
            "﻿" + buildCsv(exportRequests),
            `al_poa_requests_${timestamp}.csv`,
            "text/csv;charset=utf-8;"
        );

    };


    const handleExportExcel = () => {

        const timestamp = new Date().toISOString().slice(0, 10);

        downloadFile(
            buildExcelHtml(exportRequests),
            `al_poa_requests_${timestamp}.xls`,
            "application/vnd.ms-excel;charset=utf-8;"
        );

    };


    const handleExport = () => {

        if (exportFormat === "excel") {
            handleExportExcel();
            return;
        }

        handleExportCsv();

    };


    return (

        <div className="report-page">


            <div className="page-heading report-heading-row">

                <div>

                    <h1>
                        Reports
                    </h1>

                    <p>
                        {isAdmin
                            ? "Authorization request summary across the entire portal."
                            : isTierChecker
                                ? `Requests currently assigned to your ${tierLabel} bucket.`
                                : "Summary of the requests you have raised."}
                    </p>

                </div>

                {(isAdmin || isTierChecker) && (

                    <div className="export-buttons">

                        <select
                            value={exportFormat}
                            onChange={(event) => setExportFormat(event.target.value)}
                            aria-label="Export format"
                        >
                            <option value="csv">CSV</option>
                            <option value="excel">Excel</option>
                        </select>

                        <button
                            type="button"
                            className="export-button"
                            onClick={handleExport}
                            disabled={exportRequests.length === 0}
                        >
                            Export Tickets
                        </button>

                    </div>

                )}

            </div>


            <div className="report-cards">


                <button
                    type="button"
                    className={`report-card ${filters.status === "ALL" ? "selected" : ""}`}
                    onClick={() => handleSummaryCardClick("ALL")}
                >

                    <span>
                        Total Requests
                    </span>

                    <strong>
                        {stats.total}
                    </strong>

                </button>


                <button
                    type="button"
                    className={`report-card ${filters.status === "IN_PROGRESS" ? "selected" : ""}`}
                    onClick={() => handleSummaryCardClick("IN_PROGRESS")}
                >

                    <span>
                        In Progress
                    </span>

                    <strong>
                        {stats.inProgress}
                    </strong>

                </button>


                <button
                    type="button"
                    className={`report-card ${filters.status === STAGE.LETTER_ISSUED ? "selected" : ""}`}
                    onClick={() => handleSummaryCardClick(STAGE.LETTER_ISSUED)}
                >

                    <span>
                        Letter Issued
                    </span>

                    <strong>
                        {stats.issued}
                    </strong>

                </button>


                <button
                    type="button"
                    className={`report-card ${filters.status === "CLOSED" ? "selected" : ""}`}
                    onClick={() => handleSummaryCardClick("CLOSED")}
                >

                    <span>
                        Rejected / Withdrawn
                    </span>

                    <strong>
                        {stats.rejected + stats.withdrawn}
                    </strong>

                </button>


            </div>


            <div className="report-filters">

                {(isAdmin || isTierChecker) && (
                    <div className="filter-field">

                        <label>Search Ticket</label>

                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Request ID"
                            aria-label="Search ticket by request ID"
                        />

                    </div>
                )}

                <div className="filter-field">

                    <label>Employee ID</label>

                    <input
                        type="search"
                        value={filters.employeeId}
                        onChange={(event) => handleFilterChange("employeeId", event.target.value)}
                        placeholder="Maker Employee ID"
                        aria-label="Filter by maker employee ID"
                    />

                </div>

                <div className="filter-field">

                    <label>Current Status</label>

                    <select
                        value={filters.status}
                        onChange={(e) => handleFilterChange("status", e.target.value)}
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="CLOSED">Rejected / Withdrawn</option>
                        {Object.entries(STAGE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>

                </div>

                <div className="filter-field">

                    <label>From Date</label>

                    <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                    />

                </div>

                <div className="filter-field">

                    <label>To Date</label>

                    <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                    />

                </div>

                <div className="filter-field filter-reset">

                    <button type="button" onClick={handleResetFilters}>
                        Reset Filters
                    </button>

                </div>

            </div>


            <div className="report-table" ref={reportTableRef}>

                <h2>
                    {isAdmin ? "All Requests" : "Matching Requests"}
                </h2>

                <p className="report-table-note">
                    Showing {filteredRequests.length} of {dateFilteredRequests.length} requests
                    visible to your role.
                    {isTierChecker && " Export includes only tickets currently in your queue."}
                </p>


                <table>

                    <thead>

                        <tr>

                            <th>
                                Request ID
                            </th>

                            <th>
                                Maker
                            </th>

                            <th>
                                Department
                            </th>

                            <th>
                                Requested For
                            </th>

                            <th>
                                Status
                            </th>

                            <th>
                                Last Updated
                            </th>

                            <th>
                                View
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        {filteredRequests.length === 0 && (

                            <tr>
                                <td colSpan={7} className="empty-row">
                                    No requests match the current filters.
                                </td>
                            </tr>

                        )}

                        {filteredRequests.map((request) => (

                            <tr key={request.id}>

                                <td>
                                    {request.id}
                                </td>

                                <td>
                                    {request.requestor?.employeeId}
                                </td>

                                <td>
                                    {request.department}
                                </td>

                                <td>
                                    {request.requestedFor}
                                </td>

                                <td>
                                    {STAGE_LABELS[request.status]}
                                </td>

                                <td>
                                    {formatDateTime(request.updatedAt)}
                                </td>

                                <td>
                                    <button
                                        type="button"
                                        className="review-button"
                                        onClick={() => setSelectedRequest(request)}
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
                onClose={() => setSelectedRequest(null)}
                title="Request Details"
            />

        </div>

    );

}


export default Report;
