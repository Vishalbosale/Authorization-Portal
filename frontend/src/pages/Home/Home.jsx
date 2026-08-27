import {
    useEffect,
    useRef,
    useState
} from "react";


import {
    Link
} from "react-router-dom";


import {
    ArrowRight,
    CheckCircle2,
    ClipboardList,
    FileSignature,
    FileText,
    Hourglass,
    LayoutDashboard,
    Route as RouteIcon,
    Search,
    ShieldCheck,
    ShieldOff,
    Undo2,
    Users
} from "lucide-react";


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
    STAGE
} from "../../data/workflow";


import {
    REVOCATION_APPROVER_ROLES,
    countPendingRevocations,
    selectRevocableRequests,
    selectVisibleRevocations
} from "../../data/revocation";


import "./Home.css";


function roleQuickLinks(role) {

    if (role === "MAKER") {
        return [
            { to: "/request", label: "Create Request" },
            { to: "/my-requests", label: "My Requests" }
        ];
    }

    if (role === "ADMIN") {
        return [
            { to: "/admin", label: "Admin - 360° View" },
            { to: "/checker", label: "Approvals" },
            { to: "/revocations", label: "Revocations", tone: "revoke" },
            { to: "/report", label: "Reports" }
        ];
    }

    if (role === "HOD") {
        return [
            { to: "/checker", label: "My Approvals" },
            { to: "/revocations", label: "Revoke a Letter", tone: "revoke" },
            { to: "/my-requests", label: "My Requests" }
        ];
    }

    if (role === "ORMD_HEAD" || role === "SECRETARIAL") {
        return [
            { to: "/checker", label: "My Approvals" },
            { to: "/revocations", label: "Revocation Approvals", tone: "revoke" },
            { to: "/my-requests", label: "My Requests" }
        ];
    }

    if (role === "COO_ED") {
        return [
            { to: "/checker", label: "My Approvals" },
            { to: "/my-requests", label: "My Requests" }
        ];
    }

    return [{ to: "/request", label: "Create Request" }];

}


// Eases from the previously shown number up to `value`, so the dashboard
// tiles animate on first paint and whenever the underlying count changes.
function useCountUp(value) {

    const target = Number(value) || 0;

    const [animated, setAnimated] = useState(0);

    const [reduced] = useState(
        () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );

    const fromRef = useRef(0);
    const frameRef = useRef(0);


    useEffect(() => {

        if (reduced || target === 0) {
            return undefined;
        }

        const from = fromRef.current;
        const duration = 900;
        const start = performance.now();

        const tick = (now) => {

            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const next = Math.round(from + (target - from) * eased);

            fromRef.current = next;
            setAnimated(next);

            if (progress < 1) {
                frameRef.current = requestAnimationFrame(tick);
            }

        };

        frameRef.current = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(frameRef.current);

    }, [target, reduced]);


    return (reduced || target === 0)
        ? target
        : animated;

}


function StatValue({ value }) {

    const display = useCountUp(value);

    return <strong>{display}</strong>;

}


const FEATURES = [
    {
        icon: FileText,
        title: "Request Management",
        copy: "Create and manage authorization requests."
    },
    {
        icon: Users,
        title: "Multi-Level Approval",
        copy: "Route requests through configured approvers."
    },
    {
        icon: Search,
        title: "Request Tracking",
        copy: "Monitor your request status in real time."
    },
    {
        icon: FileSignature,
        title: "Letter Issuance",
        copy: "Access the authorization letter after final approval."
    }
];


const PIPELINE = [
    { label: "HOD", stage: STAGE.HOD_INITIAL },
    { label: "ORMD Head", stage: STAGE.ORMD_REVIEW },
    { label: "COO / ED", stage: STAGE.COO_ED_REVIEW },
    { label: "Secretarial", stage: STAGE.SECRETARIAL },
    { label: "Letter Issued", stage: STAGE.LETTER_ISSUED }
];


// Live bucket volumes are for signed-in users only. Visitors get the route a
// request travels instead - the same five stages, with no portal data in them.
const JOURNEY = [
    {
        label: "Request raised",
        copy: "Maker submits with supporting documents."
    },
    {
        label: "HOD review",
        copy: "The department head validates the need."
    },
    {
        label: "ORMD Head",
        copy: "Risk review - approve, send back or reject."
    },
    {
        label: "COO / ED",
        copy: "Final management approval."
    },
    {
        label: "Letter issued",
        copy: "Secretarial issues the AL / POA letter."
    }
];


function Home() {

    const { user } = useAuth();

    const { requests } = useRequests();

    const { revocations } = useRevocations();

    const quickLinks = user ? roleQuickLinks(user.role) : [];

    const pendingApprovalCount = user && user.role !== "MAKER"
        ? requests.filter((request) => {

            const stages = user.role === "ADMIN"
                ? Object.values(ROLE_BUCKETS).flat()
                : ROLE_BUCKETS[user.role] || [];

            return stages.includes(request.status);

        }).length
        : 0;

    const userRequests = user?.role === "MAKER"
        ? requests.filter((request) => request.requestor?.employeeId === user.employeeId)
        : requests;


    const isAdmin = user?.role === "ADMIN";

    const canRaiseRevocation = isAdmin || user?.role === "HOD";

    const canReviewRevocation = REVOCATION_APPROVER_ROLES.includes(user?.role);

    // A HOD counts the letters still open to revoke; Secretarial and the ORMD
    // Head count the revocations waiting on their approval.
    const revocationCount = !user
        ? 0
        : canRaiseRevocation
            ? selectRevocableRequests({
                requests,
                revocations,
                actingRole: "HOD",
                isAdmin,
                employeeId: user.employeeId,
                actorString: `${user.employeeName} (${user.employeeId})`
            }).length
            : canReviewRevocation
                ? countPendingRevocations(
                    selectVisibleRevocations({
                        revocations,
                        actingRole: user.role,
                        isAdmin,
                        employeeId: user.employeeId
                    }),
                    user.role,
                    isAdmin
                )
                : 0;


    const dashboardStats = [
        {
            label: user?.role === "MAKER" ? "Active Requests" : "Pending Approvals",
            value: user?.role === "MAKER"
                ? userRequests.filter((request) => ![
                    STAGE.LETTER_ISSUED,
                    STAGE.REJECTED,
                    STAGE.WITHDRAWN
                ].includes(request.status)).length
                : pendingApprovalCount,
            icon: user?.role === "MAKER" ? ClipboardList : Hourglass,
            tone: "active",
            to: user?.role === "MAKER" ? "/my-requests" : "/checker"
        },
        {
            label: "Sent Back",
            value: userRequests.filter((request) => request.status === STAGE.REQUESTER_REVISION).length,
            icon: Undo2,
            tone: "warn",
            to: user?.role === "MAKER" ? "/my-requests" : "/checker"
        },
        {
            label: "Completed",
            value: userRequests.filter((request) => request.status === STAGE.LETTER_ISSUED).length,
            icon: CheckCircle2,
            tone: "done",
            to: user?.role === "MAKER" ? "/my-requests" : "/checker"
        },
        (canRaiseRevocation || canReviewRevocation) && {
            label: canRaiseRevocation
                ? "Letters You Can Revoke"
                : "Revocations To Approve",
            value: revocationCount,
            icon: ShieldOff,
            tone: "revoke",
            to: "/revocations"
        }
    ].filter(Boolean);

    const pipelineCounts = PIPELINE.map((step) => ({
        ...step,
        count: requests.filter((request) => request.status === step.stage).length
    }));

    const pipelineMax = Math.max(
        1,
        ...pipelineCounts.map((step) => step.count)
    );


    return (

        <div className="home-page">


            <section className="home-hero">

                <div className="hero-aurora" aria-hidden="true">
                    <span className="aurora-blob blob-a" />
                    <span className="aurora-blob blob-b" />
                    <span className="aurora-blob blob-c" />
                </div>


                <div className="hero-inner">

                    <div className="hero-content">

                        <span className="hero-label">
                            <ShieldCheck size={14} />
                            Authorization Management System
                        </span>


                        <h1>
                            Authorization requests,
                            <span className="hero-highlight">
                                start to signature
                            </span>
                        </h1>


                        <p>
                            Raise, manage, approve and track authorization
                            requests through a structured, fully audited
                            multi-level workflow.
                        </p>


                        <div className="hero-buttons">

                            {user ? (

                                quickLinks.map((link, index) => (

                                    <Link
                                        key={link.to}
                                        to={link.to}
                                        className={[
                                            index === 0 ? "primary-button" : "secondary-button",
                                            link.tone === "revoke" ? "is-revoke" : ""
                                        ].filter(Boolean).join(" ")}
                                    >

                                        {link.tone === "revoke" && <ShieldOff size={15} />}

                                        {link.label}

                                        {link.label === "My Approvals" && (
                                            <span className="quick-link-count">
                                                {pendingApprovalCount}
                                            </span>
                                        )}

                                        {link.tone === "revoke" && revocationCount > 0 && (
                                            <span className="quick-link-count">
                                                {revocationCount}
                                            </span>
                                        )}

                                        {index === 0 && <ArrowRight size={16} />}

                                    </Link>

                                ))

                            ) : (

                                <Link to="/login" className="primary-button">
                                    Login to Continue
                                    <ArrowRight size={16} />
                                </Link>

                            )}


                            <Link to="/workflow" className="secondary-button">
                                View Workflow
                            </Link>

                        </div>

                    </div>


                    {user ? (

                        <div className="hero-card">

                            <div className="hero-card-top">

                                <span className="hero-card-icon">
                                    <LayoutDashboard size={20} />
                                </span>

                                <div>
                                    <h3>Approval Pipeline</h3>
                                    <span>Live across all buckets</span>
                                </div>

                            </div>


                            <ul className="hero-pipeline">

                                {pipelineCounts.map((step, index) => (

                                    <li
                                        key={step.stage}
                                        style={{ "--row": index }}
                                    >

                                        <span className="pipeline-label">
                                            {step.label}
                                        </span>

                                        <span className="pipeline-track">
                                            <span
                                                className="pipeline-fill"
                                                style={{
                                                    "--fill": `${Math.round((step.count / pipelineMax) * 100)}%`,
                                                    "--row": index
                                                }}
                                            />
                                        </span>

                                        <span className="pipeline-count">
                                            {step.count}
                                        </span>

                                    </li>

                                ))}

                            </ul>


                            <p className="hero-card-note">
                                {requests.length > 0
                                    ? `${requests.length} request${requests.length === 1 ? "" : "s"} in the system`
                                    : "No requests in the system yet"}
                            </p>

                        </div>

                    ) : (

                        <div className="hero-card hero-card-guest">

                            <div className="hero-card-top">

                                <span className="hero-card-icon">
                                    <RouteIcon size={20} />
                                </span>

                                <div>
                                    <h3>The Route a Request Takes</h3>
                                    <span>Five stages, one audited trail</span>
                                </div>

                            </div>


                            <ol className="hero-journey">

                                {JOURNEY.map((step, index) => (

                                    <li
                                        key={step.label}
                                        style={{ "--row": index }}
                                    >

                                        <span className="journey-marker">
                                            {index + 1}
                                        </span>

                                        <span className="journey-copy">
                                            <strong>{step.label}</strong>
                                            <span>{step.copy}</span>
                                        </span>

                                    </li>

                                ))}

                            </ol>


                            <p className="hero-card-note">
                                Sign in to see live request volumes across
                                every bucket.
                            </p>

                        </div>

                    )}

                </div>

            </section>


            {user && (

                <section className="dashboard-section">

                    <div className="dashboard-heading">

                        <div>
                            <span className="section-kicker">Live overview</span>
                            <h2>Workflow at a glance</h2>
                        </div>

                        <span className="dashboard-role">
                            {user.role === "MAKER"
                                ? "Maker view"
                                : `${user.role === "ADMIN" ? "Admin" : "Approval"} view`}
                        </span>

                    </div>


                    <div className="dashboard-stats">

                        {dashboardStats.map((stat, index) => {

                            const Icon = stat.icon;

                            return (

                                <Link
                                    key={stat.label}
                                    to={stat.to}
                                    className={`dashboard-stat tone-${stat.tone}`}
                                    style={{ "--i": index }}
                                >

                                    <span className="dashboard-stat-icon">
                                        <Icon size={20} />
                                    </span>

                                    <span className="dashboard-stat-copy">
                                        <StatValue value={stat.value} />
                                        <span>{stat.label}</span>
                                    </span>

                                    <span className="dashboard-stat-arrow">
                                        <ArrowRight size={17} />
                                    </span>

                                </Link>

                            );

                        })}

                    </div>

                </section>

            )}


            <section className="home-section">

                <div className="home-section-heading">
                    <span className="section-kicker">Capabilities</span>
                    <h2>Portal Features</h2>
                </div>


                <div className="feature-grid">

                    {FEATURES.map((feature, index) => {

                        const Icon = feature.icon;

                        return (

                            <article
                                key={feature.title}
                                className="feature-card"
                                style={{ "--i": index }}
                            >

                                <span className="feature-icon">
                                    <Icon size={20} />
                                </span>

                                <h3>{feature.title}</h3>

                                <p>{feature.copy}</p>

                            </article>

                        );

                    })}

                </div>

            </section>

        </div>

    );

}


export default Home;
