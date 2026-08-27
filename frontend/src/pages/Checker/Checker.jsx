import {
    useMemo,
    useState
} from "react";


import {
    Navigate,
    useLocation,
    useSearchParams
} from "react-router-dom";


import {
    useAuth
} from "../../context/AuthContext";


import {
    useRequests
} from "../../context/RequestsContext";


import {
    useRevocations
} from "../../context/RevocationsContext";


import {
    ROLE_BUCKETS,
    ROLE_LABELS,
    STAGE,
    STAGE_ACTIONS,
    STAGE_LABELS,
    formatDateTime
} from "../../data/workflow";


import {
    REVOCATION_APPROVER_ROLES,
    REVOCATION_STAGE,
    REVOCATION_STAGE_LABELS,
    REVOCATION_STAGE_ROLE,
    countPendingRevocations,
    getRevocationReason,
    selectRevocableRequests,
    selectVisibleRevocations
} from "../../data/revocation";


import RequestDetailModal from "../../components/RequestDetail/RequestDetail";

import RevokeRequestModal from "../../components/RevokeRequestModal/RevokeRequestModal";

import RevocationDetailModal from "../../components/RevocationDetail/RevocationDetail";


import "./Checker.css";


const ROLE_ORDER = ["HOD", "ORMD_HEAD", "COO_ED", "SECRETARIAL"];

const FORWARD_ACTION_LABELS = ["Approved", "Submitted for Final Approval", "Letter Issued"];

const TAB_KEYS = [
    "PENDING",
    "APPROVED",
    "SENT_BACK",
    "REJECTED",
    "HISTORY",
    "REVOCABLE",
    "REVOCATIONS"
];


// The tab a role lands on when it arrives through the header's Revocations
// link: a HOD raises revocations, everyone else reviews them.
function revocationLandingTab(role) {

    return role === "HOD"
        ? "REVOCABLE"
        : "REVOCATIONS";

}


function stageBadgeTone(status) {

    if (status === STAGE.HOD_INITIAL) return "badge-hod";
    if (status === STAGE.ORMD_REVIEW) return "badge-ormd";
    if (status === STAGE.COO_ED_REVIEW) return "badge-coo";
    if (status === STAGE.SECRETARIAL) return "badge-secretarial";

    return "badge-default";

}


// The identifier of whoever the letter is for. "Self" is the requestor,
// "Others" carries a colleague's employee ID, and a Third Party carries the
// vendor's ID - the request holds each in a different field.
function requestedForId(request) {

    if (request.requestedFor === "Others") {
        return request.requestedForEmployeeId || "-";
    }

    if (request.requestedFor === "Third Party") {
        return request.thirdPartyId || "-";
    }

    return request.requestor?.employeeId || "-";

}


function revocationBadgeTone(status) {

    if (status === REVOCATION_STAGE.SECRETARIAL_REVIEW) return "badge-secretarial";
    if (status === REVOCATION_STAGE.ORMD_FINAL) return "badge-ormd";
    if (status === REVOCATION_STAGE.REVOKED) return "badge-revoked";

    return "badge-closed";

}


function Checker() {

    const { user } =
        useAuth();

    const {
        requests,
        takeAction
    } = useRequests();

    const {
        revocations,
        createRevocation,
        takeRevocationAction
    } = useRevocations();


    const location = useLocation();

    const [searchParams] = useSearchParams();

    const tabParam = searchParams.get("tab");

    // /revocations is an alias of this page that opens straight on the
    // revocation tab, so the flow is one click from the header.
    const onRevocationsRoute = location.pathname === "/revocations";


    const isAdmin = user?.role === "ADMIN";

    const isApproverRole = Boolean(ROLE_BUCKETS[user?.role]);

    const visibleRoles = useMemo(() => {

        if (user.role === "ADMIN") return ROLE_ORDER;
        if (ROLE_BUCKETS[user.role]) return [user.role];
        return [];

    }, [user.role]);


    const [
        actingRole,
        setActingRole
    ] = useState(() => {

        if (isAdmin) return "HOD";
        if (isApproverRole) return user.role;
        return "HOD";

    });

    const [
        activeTab,
        setActiveTab
    ] = useState(() => {

        if (TAB_KEYS.includes(tabParam)) {
            return tabParam;
        }

        if (onRevocationsRoute) {
            return revocationLandingTab(isAdmin ? "HOD" : user.role);
        }

        return "PENDING";

    });

    const [lastTabParam, setLastTabParam] = useState(tabParam);


    // A ?tab= change on the same route (the header link clicked twice, a back
    // navigation) has to move the tab without waiting for a remount.
    if (lastTabParam !== tabParam) {

        setLastTabParam(tabParam);

        if (TAB_KEYS.includes(tabParam)) {
            setActiveTab(tabParam);
        }

    }

    const [
        selectedRequest,
        setSelectedRequest
    ] = useState(null);

    const [
        remark,
        setRemark
    ] = useState("");

    const [
        letterReference,
        setLetterReference
    ] = useState("");

    const [
        letterDocument,
        setLetterDocument
    ] = useState("");

    const [
        letterDocumentData,
        setLetterDocumentData
    ] = useState("");

    const [
        issueExpiryDate,
        setIssueExpiryDate
    ] = useState("");

    const [
        searchTerm,
        setSearchTerm
    ] = useState("");

    const [
        revokeTarget,
        setRevokeTarget
    ] = useState(null);

    const [
        selectedRevocation,
        setSelectedRevocation
    ] = useState(null);


    const actorString = `${user.employeeName} (${user.employeeId})`;

    const tierLabel = ROLE_LABELS[actingRole];

    const tierActions = useMemo(() => {

        const stages = ROLE_BUCKETS[actingRole] || [];
        const actionSet = new Set();

        stages.forEach((stage) => {
            (STAGE_ACTIONS[stage] || []).forEach((definition) => actionSet.add(definition.action));
        });

        return actionSet;

    }, [actingRole]);


    const revocableRequests = useMemo(() => selectRevocableRequests({
        requests,
        revocations,
        actingRole,
        isAdmin,
        employeeId: user.employeeId,
        actorString
    }), [requests, revocations, actingRole, isAdmin, user.employeeId, actorString]);


    const visibleRevocations = useMemo(() => selectVisibleRevocations({
        revocations,
        actingRole,
        isAdmin,
        employeeId: user.employeeId
    }), [revocations, actingRole, isAdmin, user.employeeId]);


    const pendingRevocationCount = useMemo(
        () => countPendingRevocations(visibleRevocations, actingRole, isAdmin),
        [visibleRevocations, actingRole, isAdmin]
    );


    // What is waiting in each tier the user can act as - requests in that
    // bucket plus revocations at that tier's stage. An Admin switches between
    // all four, so the counts have to be on the switcher itself; otherwise
    // the only way to find the work is to open every tier in turn.
    const pendingCountByRole = useMemo(() => {

        const counts = {};

        for (const role of visibleRoles) {

            const stages = ROLE_BUCKETS[role] || [];

            const pendingRequests = requests.filter(
                (request) => stages.includes(request.status)
            ).length;

            // visibleRevocations is already scoped to what this user may see:
            // every revocation for an Admin, only their own assignments else.
            const pendingRevocations = visibleRevocations.filter(
                (revocation) => REVOCATION_STAGE_ROLE[revocation.status] === role
            ).length;

            counts[role] = pendingRequests + pendingRevocations;

        }

        return counts;

    }, [requests, visibleRevocations, visibleRoles]);


    const tabs = useMemo(() => {

        const list = [
            { key: "PENDING", label: "Pending Actions" }
        ];

        if (tierActions.has("APPROVE") || tierActions.has("SUBMIT") || tierActions.has("ISSUE_LETTER")) {
            list.push({ key: "APPROVED", label: "Approved" });
        }

        if (tierActions.has("SEND_BACK")) {
            list.push({ key: "SENT_BACK", label: "Sent Back" });
        }

        if (tierActions.has("REJECT")) {
            list.push({ key: "REJECTED", label: "Rejected" });
        }

        list.push({ key: "HISTORY", label: "Completed" });

        // Revocation is a HOD-initiated flow reviewed by Secretarial and
        // then the ORMD Head, so only those tiers get these tabs.
        if (actingRole === "HOD") {
            list.push({
                key: "REVOCABLE",
                label: "Issued - Revocable",
                count: revocableRequests.length
            });
        }

        if (REVOCATION_APPROVER_ROLES.includes(actingRole) || actingRole === "HOD") {
            list.push({
                key: "REVOCATIONS",
                label: "Revocations",
                count: pendingRevocationCount
            });
        }

        return list;

    }, [tierActions, actingRole, revocableRequests.length, pendingRevocationCount]);


    // A tab that the acting role does not own (a stale ?tab=, or a tier switch
    // away from the revocation tabs) falls back to the pending bucket.
    if (!tabs.some((tab) => tab.key === activeTab)) {
        setActiveTab("PENDING");
    }


    const bucketRequests = useMemo(() => {

        if (!visibleRoles.includes(actingRole)) {
            return [];
        }

        const visibleStages = ROLE_BUCKETS[actingRole] || [];

        return requests
            .filter((request) => visibleStages.includes(request.status))
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    }, [requests, actingRole, visibleRoles]);


    const myActionedRequests = useMemo(() => {

        return requests
            .filter((request) =>
                request.audit.some(
                    (entry) => entry.role === tierLabel && entry.actor === actorString
                )
            )
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    }, [requests, tierLabel, actorString]);


    const tabRequests = useMemo(() => {

        if (activeTab === "PENDING") {
            return bucketRequests;
        }

        if (activeTab === "HISTORY") {
            return myActionedRequests;
        }

        const wantedLabels =
            activeTab === "APPROVED" ? FORWARD_ACTION_LABELS :
            activeTab === "REJECTED" ? ["Rejected"] :
            activeTab === "SENT_BACK" ? ["Sent Back"] :
            [];

        return myActionedRequests.filter((request) =>
            request.audit.some(
                (entry) =>
                    entry.role === tierLabel &&
                    entry.actor === actorString &&
                    wantedLabels.includes(entry.action)
            )
        );

    }, [activeTab, bucketRequests, myActionedRequests, tierLabel, actorString]);


    const searchedRequests = useMemo(() => {

        const normalizedSearch = searchTerm.trim().toLowerCase();

        if (!normalizedSearch) {
            return tabRequests;
        }

        return tabRequests.filter((request) =>
            request.id.toLowerCase().includes(normalizedSearch)
        );

    }, [tabRequests, searchTerm]);


    const openReview = (request) => {

        setSelectedRequest(request);
        setRemark("");
        setLetterReference("");
        setLetterDocument("");
        setLetterDocumentData("");
        setIssueExpiryDate("");

    };


    const closeReview = () => {

        setSelectedRequest(null);
        setRemark("");
        setLetterReference("");
        setLetterDocument("");
        setLetterDocumentData("");

    };


    const handleAction = async (actionDef) => {

        if (!selectedRequest) {
            return;
        }

        if (actionDef.remarkRequired && !remark.trim()) {

            alert(`A remark is required to ${actionDef.label.toLowerCase()} this request.`);

            return;

        }

        if (actionDef.action === "ISSUE_LETTER" && !letterReference.trim()) {

            alert("Please enter the AL / POA letter reference number before issuing.");

            return;

        }

        if (actionDef.action === "ISSUE_LETTER" && !issueExpiryDate) {

            alert("Please select the expiry date before issuing the letter.");

            return;

        }

        if (actionDef.action === "ISSUE_LETTER" && !letterDocumentData) {

            alert("Please attach the issued letter before issuing.");

            return;

        }

        const extra = actionDef.action === "ISSUE_LETTER"
            ? {
                letterReference: letterReference.trim(),
                expiryDate: issueExpiryDate,
                letterDocument: letterDocument || undefined,
                letterDocumentData: letterDocumentData || undefined
            }
            : undefined;

        try {

            await takeAction(
                selectedRequest.id,
                actionDef.action,
                {
                    remark: remark.trim() || (actionDef.action === "ISSUE_LETTER" ? `Letter ${letterReference.trim()} issued.` : ""),
                    extra
                }
            );

            closeReview();

        } catch (error) {

            console.error("Failed to process action:", error);

            alert(
                error.message ||
                "Unable to process this action. Please try again."
            );

        }

    };


    const handleRevocationSubmit = async (payload) => {

        await createRevocation(payload);

        setRevokeTarget(null);
        setActiveTab("REVOCATIONS");

    };


    const handleRevocationAction = async (revocationId, action, actionRemark) => {

        const updated = await takeRevocationAction(revocationId, action, actionRemark);

        setSelectedRevocation(updated);

    };


    if (user.role === "MAKER") {
        return <Navigate to="/my-requests" replace />;
    }


    const availableActions = selectedRequest && activeTab === "PENDING"
        ? (STAGE_ACTIONS[selectedRequest.status] || [])
        : [];


    return (

        <div className="checker-page">


            <div className="page-heading">

                <h1>
                    Approvals
                </h1>

                <p>
                    Review authorization requests assigned to your bucket.
                </p>

            </div>


            {visibleRoles.length > 1 && (

                <div className="role-switcher">

                    <span>Acting As:</span>

                    {visibleRoles.map((role) => (

                        <button
                            key={role}
                            type="button"
                            className={role === actingRole ? "role-tab active" : "role-tab"}
                            title={`${pendingCountByRole[role] || 0} item(s) awaiting the ${ROLE_LABELS[role]} tier`}
                            onClick={() => {
                                setActingRole(role);
                                setActiveTab("PENDING");
                                closeReview();
                            }}
                        >
                            {ROLE_LABELS[role]}

                            {pendingCountByRole[role] > 0 && (
                                <span className="tab-count">
                                    {pendingCountByRole[role]}
                                </span>
                            )}
                        </button>

                    ))}

                </div>

            )}


            {visibleRoles.length === 1 && (

                <div className="role-switcher">

                    <span>Your Bucket:</span>

                    <span className="role-tab active locked">
                        {ROLE_LABELS[visibleRoles[0]]}

                        {pendingCountByRole[visibleRoles[0]] > 0 && (
                            <span className="tab-count">
                                {pendingCountByRole[visibleRoles[0]]}
                            </span>
                        )}
                    </span>

                </div>

            )}


            {visibleRoles.length === 0 && (

                <div className="no-bucket-note">
                    Your role ({user?.role ? user.role : "unknown"}) does not
                    have an approvals bucket. Approvals are handled by HOD,
                    ORMD Head, COO / ED and Secretarial.
                </div>

            )}


            {visibleRoles.length > 0 && (

                <div className="history-tabs">

                    {tabs.map((tab) => (

                        <button
                            key={tab.key}
                            type="button"
                            className={tab.key === activeTab ? "history-tab active" : "history-tab"}
                            onClick={() => {
                                setActiveTab(tab.key);
                                closeReview();
                            }}
                        >
                            {tab.label}
                            {tab.count > 0 && (
                                <span className="tab-count">{tab.count}</span>
                            )}
                        </button>

                    ))}

                </div>

            )}


            {visibleRoles.length > 0 && (

            <div className="checker-search">

                <label htmlFor="approval-ticket-search">
                    Search Ticket
                </label>

                <input
                    id="approval-ticket-search"
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by ticket ID"
                />

            </div>

            )}


            {visibleRoles.length > 0 && activeTab === "REVOCABLE" && (

            <div className="checker-table-container">

                <table>

                    <thead>

                        <tr>
                            <th>Request ID</th>
                            <th>Requestor</th>
                            <th>Requested For</th>
                            <th>Requested For ID</th>
                            <th>Letter Type</th>
                            <th>AL / POA Reference</th>
                            <th>Expiry Date</th>
                            <th>Action</th>
                        </tr>

                    </thead>

                    <tbody>

                        {revocableRequests.filter((request) =>
                            request.id.toLowerCase().includes(searchTerm.trim().toLowerCase())
                        ).length === 0 && (

                            <tr>
                                <td colSpan={8} className="empty-row">
                                    You have no issued requests available to revoke.
                                </td>
                            </tr>

                        )}

                        {revocableRequests
                            .filter((request) =>
                                request.id.toLowerCase().includes(searchTerm.trim().toLowerCase())
                            )
                            .map((request) => (

                                <tr key={request.id}>

                                    <td>{request.id}</td>

                                    <td>
                                        {request.requestor?.employeeName}
                                        <span className="muted-id">
                                            {" "}({request.requestor?.employeeId})
                                        </span>
                                    </td>

                                    <td>{request.requestedFor || "-"}</td>

                                    <td>{requestedForId(request)}</td>

                                    <td>{request.letterType}</td>

                                    <td>{request.letterReference || "-"}</td>

                                    <td>{request.expiryDate || "-"}</td>

                                    <td>
                                        <button
                                            type="button"
                                            className="revoke-button"
                                            onClick={() => setRevokeTarget(request)}
                                        >
                                            Revoke
                                        </button>
                                    </td>

                                </tr>

                            ))}

                    </tbody>

                </table>

            </div>

            )}


            {visibleRoles.length > 0 && activeTab === "REVOCATIONS" && (

            <div className="checker-table-container">

                <table>

                    <thead>

                        <tr>
                            <th>Revocation ID</th>
                            <th>Request ID</th>
                            <th>Reason</th>
                            <th>Initiated By</th>
                            <th>Stage</th>
                            <th>Last Updated</th>
                            <th>Action</th>
                        </tr>

                    </thead>

                    <tbody>

                        {visibleRevocations.filter((revocation) => {

                            const term = searchTerm.trim().toLowerCase();

                            return !term ||
                                revocation.id.toLowerCase().includes(term) ||
                                revocation.requestId.toLowerCase().includes(term);

                        }).length === 0 && (

                            <tr>
                                <td colSpan={7} className="empty-row">
                                    No revocations in this view.
                                </td>
                            </tr>

                        )}

                        {visibleRevocations
                            .filter((revocation) => {

                                const term = searchTerm.trim().toLowerCase();

                                return !term ||
                                    revocation.id.toLowerCase().includes(term) ||
                                    revocation.requestId.toLowerCase().includes(term);

                            })
                            .map((revocation) => {

                                const reason = getRevocationReason(revocation.reasonCode);

                                const awaitingMe =
                                    REVOCATION_STAGE_ROLE[revocation.status] === actingRole;

                                return (

                                    <tr key={revocation.id}>

                                        <td>{revocation.id}</td>

                                        <td>{revocation.requestId}</td>

                                        <td className="purpose-cell">
                                            {reason ? reason.label : revocation.reasonCode}
                                        </td>

                                        <td>
                                            {revocation.initiatedBy?.employeeName}
                                            <span className="muted-id">
                                                {" "}({revocation.initiatedBy?.employeeId})
                                            </span>
                                        </td>

                                        <td>
                                            <span className={`stage-badge ${revocationBadgeTone(revocation.status)}`}>
                                                {REVOCATION_STAGE_LABELS[revocation.status]}
                                            </span>
                                        </td>

                                        <td>{formatDateTime(revocation.updatedAt)}</td>

                                        <td>
                                            <button
                                                type="button"
                                                className="review-button"
                                                onClick={() => setSelectedRevocation(revocation)}
                                            >
                                                {awaitingMe ? "Review" : "View"}
                                            </button>
                                        </td>

                                    </tr>

                                );

                            })}

                    </tbody>

                </table>

            </div>

            )}


            {visibleRoles.length > 0 && activeTab !== "REVOCABLE" && activeTab !== "REVOCATIONS" && (

            <div className="checker-table-container">

                <table>

                    <thead>

                        <tr>

                            <th>
                                Request ID
                            </th>

                            <th>
                                Requestor
                            </th>

                            <th>
                                Requested For
                            </th>

                            <th>
                                Requested For ID
                            </th>

                            <th>
                                Department
                            </th>

                            <th>
                                Purpose
                            </th>

                            <th>
                                Stage
                            </th>

                            <th>
                                Last Updated
                            </th>

                            <th>
                                Action
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        {searchedRequests.length === 0 && (

                            <tr>
                                <td colSpan={9} className="empty-row">
                                    No requests in this view.
                                </td>
                            </tr>

                        )}

                        {searchedRequests.map(
                            request => (

                                <tr
                                    key={
                                        request.id
                                    }
                                >

                                    <td>
                                        {
                                            request.id
                                        }
                                    </td>

                                    <td>
                                        {request.requestor?.employeeName}
                                        <span className="muted-id">
                                            {" "}({request.requestor?.employeeId})
                                        </span>
                                    </td>

                                    <td>
                                        {request.requestedFor || "-"}
                                    </td>

                                    <td>
                                        {requestedForId(request)}
                                    </td>

                                    <td>
                                        {
                                            request.department
                                        }
                                    </td>

                                    <td className="purpose-cell">
                                        {
                                            request.purpose
                                        }
                                    </td>

                                    <td>

                                        <span className={`stage-badge ${stageBadgeTone(request.status)}`}>
                                            {STAGE_LABELS[request.status]}
                                        </span>

                                    </td>

                                    <td>
                                        {formatDateTime(request.updatedAt)}
                                    </td>

                                    <td>

                                        <button
                                            className="review-button"
                                            onClick={() =>
                                                openReview(
                                                    request
                                                )
                                            }
                                        >

                                            {activeTab === "PENDING" ? "Review" : "View"}

                                        </button>

                                    </td>

                                </tr>

                            )
                        )}

                    </tbody>

                </table>

            </div>

            )}


            <RequestDetailModal
                request={selectedRequest}
                onClose={closeReview}
                title="Review Request"
            >

                {selectedRequest && (

                    availableActions.length > 0 ? (

                        <div className="modal-section action-section">

                            <h3>Take Action - Acting as {tierLabel}</h3>

                            {availableActions.some((a) => a.action === "ISSUE_LETTER") && (

                                <>

                                    <div className="letter-reference-field">

                                        <label>AL / POA Letter Reference *</label>

                                        <input
                                            value={letterReference}
                                            onChange={(e) => setLetterReference(e.target.value)}
                                            placeholder="e.g. AL/POA-2026-0012"
                                        />

                                    </div>

                                    <div className="letter-reference-field">

                                        <label>Expiry Date *</label>

                                        <input
                                            type="date"
                                            value={issueExpiryDate}
                                            onChange={(e) => setIssueExpiryDate(e.target.value)}
                                            required
                                        />

                                    </div>

                                    <div className="letter-reference-field">

                                        <label>Attach Issued Letter *</label>

                                        <input
                                            type="file"
                                            accept=".pdf,.doc,.docx"
                                            required
                                            onChange={(e) => {

                                                const file = e.target.files?.[0];

                                                if (!file) {
                                                    return;
                                                }

                                                setLetterDocument(file.name);

                                                const reader = new FileReader();

                                                reader.onload = () => {
                                                    setLetterDocumentData(String(reader.result || ""));
                                                };

                                                reader.readAsDataURL(file);

                                            }}
                                        />

                                    </div>

                                </>

                            )}

                            <label>Remark {availableActions.some((a) => a.remarkRequired) ? "" : "(optional)"}</label>

                            <textarea
                                rows="3"
                                value={remark}
                                onChange={(e) => setRemark(e.target.value)}
                                placeholder="Enter remark"
                            />

                            <div className="checker-actions">

                                {availableActions.map((actionDef) => (

                                    <button
                                        key={actionDef.action}
                                        className={`action-button tone-${actionDef.tone}`}
                                        onClick={() => handleAction(actionDef)}
                                    >
                                        {actionDef.label}
                                    </button>

                                ))}

                            </div>

                        </div>

                    ) : (

                        <div className="modal-section action-section">

                            <p className="no-action-note">
                                {activeTab === "PENDING"
                                    ? `No action available for the ${tierLabel} role at this stage.`
                                    : "This request has already been actioned - shown here for reference only."}
                            </p>

                        </div>

                    )

                )}

            </RequestDetailModal>


            <RevokeRequestModal
                request={revokeTarget}
                onClose={() => setRevokeTarget(null)}
                onSubmit={handleRevocationSubmit}
            />


            <RevocationDetailModal
                revocation={selectedRevocation}
                user={user}
                onClose={() => setSelectedRevocation(null)}
                onAction={handleRevocationAction}
            />

        </div>

    );

}


export default Checker;
