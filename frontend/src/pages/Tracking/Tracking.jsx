import {
    useState
} from "react";


import {
    useAuth
} from "../../context/AuthContext";


import {
    useRequests
} from "../../context/RequestsContext";


import {
    HAPPY_PATH,
    ROLE_BUCKETS,
    ROLE_LABELS,
    STAGE,
    STAGE_LABELS,
    TERMINAL_STAGES,
    TIMELINE_STEP_LABELS,
    formatDateTime
} from "../../data/workflow";


import "./Tracking.css";


function buildTimeline(request) {

    if (!request) {
        return [];
    }

    // If the request was ever sent back, show that as a detour step right
    // after ORMD Head Review, before continuing the happy path.
    const wasSentBackToRequester = request.audit.some(
        (entry) => entry.toStage === STAGE.REQUESTER_REVISION
    );

    const isCurrentlyReturned = request.status === STAGE.REQUESTER_REVISION;

    // A revoked request completed the whole happy path before it was revoked,
    // so it is not an early exit - the revocation is appended as a final step.
    const isRevoked = request.status === STAGE.REVOKED;

    const isExited =
        TERMINAL_STAGES.includes(request.status) &&
        request.status !== STAGE.LETTER_ISSUED &&
        !isRevoked;

    const exitIndex = isExited ? currentIndexOfExitPoint(request) : null;

    const ormdIndex = HAPPY_PATH.indexOf(STAGE.ORMD_REVIEW);

    const currentIndex = HAPPY_PATH.indexOf(request.status);

    const steps = HAPPY_PATH.map((stage, index) => {

        let status = "pending";

        if (isRevoked) {
            status = "completed";
        } else if (isExited) {
            // Rejected / Withdrawn: everything up to (not including) the
            // stage where it happened is completed.
            status = index < exitIndex ? "completed" : "pending";
        } else if (isCurrentlyReturned) {
            status = index < ormdIndex ? "completed" : "pending";
        } else if (currentIndex === -1) {
            status = "pending";
        } else if (index < currentIndex) {
            status = "completed";
        } else if (index === currentIndex) {
            status = request.status === STAGE.LETTER_ISSUED ? "completed" : "current";
        }

        return {
            key: stage,
            title: TIMELINE_STEP_LABELS[stage],
            status
        };

    });

    if (wasSentBackToRequester) {

        steps.splice(ormdIndex + 1, 0, {
            key: "SENT_BACK",
            title: "Sent Back to Requester",
            status: isCurrentlyReturned ? "current" : "completed"
        });

    }

    if (request.status === STAGE.REJECTED) {

        steps.push({
            key: "REJECTED",
            title: "Rejected / Closed",
            status: "rejected"
        });

    }

    if (request.status === STAGE.WITHDRAWN) {

        steps.push({
            key: "WITHDRAWN",
            title: "Withdrawn / Closed",
            status: "rejected"
        });

    }

    if (isRevoked) {

        steps.push({
            key: "REVOKED",
            title: "AL / POA Revoked",
            status: "rejected"
        });

    }

    return steps;

}


function currentIndexOfExitPoint(request) {

    // Find the audit entry that moved the request into REJECTED/WITHDRAWN
    // and map its fromStage back to a happy-path index.
    const exitEntry = [...request.audit].reverse().find(
        (entry) => entry.toStage === STAGE.REJECTED || entry.toStage === STAGE.WITHDRAWN
    );

    if (!exitEntry) {
        return HAPPY_PATH.length;
    }

    const index = HAPPY_PATH.indexOf(exitEntry.fromStage);

    return index === -1 ? HAPPY_PATH.length : index + 1;

}


// Per the access spec: Maker can only track their own requests, a Checker
// can only track requests currently in their bucket or ones they have
// actioned, and Admin can track anything.
function canViewRequest(request, user) {

    if (user.role === "ADMIN") {
        return true;
    }

    if (ROLE_BUCKETS[user.role]) {

        const tierLabel = ROLE_LABELS[user.role];
        const actorString = `${user.employeeName} (${user.employeeId})`;

        return ROLE_BUCKETS[user.role].includes(request.status) ||
            request.audit.some((entry) => entry.role === tierLabel && entry.actor === actorString);

    }

    return request.requestor?.employeeId === user.employeeId;

}


function Tracking() {

    const { user } =
        useAuth();

    const { getRequest } =
        useRequests();

    const [
        requestId,
        setRequestId
    ] = useState("");

    const [
        request,
        setRequest
    ] = useState(null);

    const [
        notFound,
        setNotFound
    ] = useState(false);

    const [
        accessDenied,
        setAccessDenied
    ] = useState(false);


    const handleSearch = () => {

        if (!requestId.trim()) {

            return;

        }

        const found = getRequest(requestId.trim());

        if (!found) {

            setRequest(null);
            setNotFound(true);
            setAccessDenied(false);

            return;

        }

        if (!canViewRequest(found, user)) {

            setRequest(null);
            setNotFound(false);
            setAccessDenied(true);

            return;

        }

        setRequest(found);
        setNotFound(false);
        setAccessDenied(false);

    };


    const timeline = buildTimeline(request);


    return (

        <div className="tracking-page">


            <div className="page-heading">

                <h1>
                    Request Tracking
                </h1>

                <p>
                    Track the current status of
                    your authorization request.
                </p>

            </div>


            <div className="tracking-search">

                <input
                    value={requestId}
                    onChange={(e) =>
                        setRequestId(
                            e.target.value
                        )
                    }
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            handleSearch();
                        }
                    }}
                    placeholder="Enter Request ID (e.g. REQ-00001)"
                />


                <button
                    onClick={handleSearch}
                >

                    Track Request

                </button>

            </div>


            {notFound && (

                <div className="tracking-not-found">
                    No request found with ID "{requestId}".
                </div>

            )}


            {accessDenied && (

                <div className="tracking-not-found">
                    You do not have permission to view request "{requestId}".
                    You can only track requests you raised, or requests
                    currently or previously in your bucket.
                </div>

            )}


            {request && (

                <div className="tracking-result">


                    <div className="tracking-summary">

                        <div>

                            <span>
                                Request ID
                            </span>

                            <strong>
                                {request.id}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Letter Type
                            </span>

                            <strong>
                                {request.letterType}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Current Status
                            </span>

                            <strong>
                                {STAGE_LABELS[request.status]}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Requestor
                            </span>

                            <strong>
                                {request.requestor?.employeeName} ({request.requestor?.employeeId})
                            </strong>

                        </div>


                        <div>

                            <span>
                                Purpose
                            </span>

                            <strong>
                                {request.purpose}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Last Updated
                            </span>

                            <strong>
                                {formatDateTime(request.updatedAt)}
                            </strong>

                        </div>

                    </div>


                    <div className="tracking-timeline">


                        {timeline.map(
                            (step) => (

                                <div
                                    className={
                                        `tracking-step ${step.status}`
                                    }
                                    key={step.key}
                                >

                                    <div className="tracking-dot">
                                        {step.status ===
                                        "completed"
                                            ? "✓"
                                            : step.status === "rejected"
                                            ? "✕"
                                            : "●"}
                                    </div>


                                    <div>

                                        <h3>
                                            {
                                                step.title
                                            }
                                        </h3>


                                        <span>

                                            {
                                                step.status ===
                                                "completed"
                                                    ? "Completed"
                                                    : step.status ===
                                                      "current"
                                                    ? "In Progress"
                                                    : step.status === "rejected"
                                                    ? "Closed"
                                                    : "Pending"
                                            }

                                        </span>

                                    </div>

                                </div>

                            )
                        )}

                    </div>


                    <div className="tracking-audit">

                        <h2>Complete Audit Trail</h2>

                        <ul>

                            {request.audit.map((entry, index) => (

                                <li key={index}>

                                    <div className="audit-row-top">
                                        <strong>{entry.action}</strong>
                                        <span>{formatDateTime(entry.timestamp)}</span>
                                    </div>

                                    <div className="audit-row-actor">
                                        {entry.actor} - {entry.role}
                                    </div>

                                    {entry.remark && (
                                        <div className="audit-row-remark">
                                            "{entry.remark}"
                                        </div>
                                    )}

                                </li>

                            ))}

                        </ul>

                    </div>

                </div>

            )}

        </div>

    );

}


export default Tracking;
