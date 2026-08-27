import {
    useEffect,
    useMemo,
    useState
} from "react";


import {
    Navigate,
    Link
} from "react-router-dom";


import {
    useAuth
} from "../../context/AuthContext";


import {
    useRequests
} from "../../context/RequestsContext";


import {
    STAGE_LABELS,
    TERMINAL_STAGES,
    formatDateTime
} from "../../data/workflow";


import RequestDetailModal from "../../components/RequestDetail/RequestDetail";


import "./Admin.css";

const API_URL = "http://127.0.0.1:5000";

function Admin() {

    const { user } =
        useAuth();

    const { requests } =
        useRequests();


    const [
        selectedRequest,
        setSelectedRequest
    ] = useState(null);

    const [
        employees,
        setEmployees
    ] = useState([]);

    const [
        requestIdSearch,
        setRequestIdSearch
    ] = useState("");

    const [
        userEmployeeIdSearch,
        setUserEmployeeIdSearch
    ] = useState("");

    useEffect(() => {

        if (!user || user.role !== "ADMIN") {
            return;
        }

        fetch(`${API_URL}/api/employees`, { credentials: "include" })
            .then((response) => response.json())
            .then((body) => setEmployees(body.data || []))
            .catch((error) => console.error("Failed to load employees:", error));

    }, [user]);


    const stats = useMemo(() => {

        const total = requests.length;

        const open = requests.filter((r) => !TERMINAL_STAGES.includes(r.status)).length;

        const closed = total - open;

        return { total, open, closed };

    }, [requests]);


    const sortedRequests = useMemo(() => {

        return [...requests].sort(
            (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
        );

    }, [requests]);


    const visibleRequests = sortedRequests.filter((request) =>
        !requestIdSearch.trim() ||
        request.id.toLowerCase().includes(requestIdSearch.trim().toLowerCase())
    );

    const visibleEmployees = employees.filter((employee) =>
        !userEmployeeIdSearch.trim() ||
        employee.employee_id.toLowerCase().includes(userEmployeeIdSearch.trim().toLowerCase())
    );


    if (user.role !== "ADMIN") {
        return <Navigate to="/" replace />;
    }


    return (

        <div className="admin-page">


            <div className="page-heading">

                <h1>
                    Admin - 360° View
                </h1>

                <p>
                    Full oversight across every request, stage, bucket and
                    user in the portal.
                </p>

            </div>


            <div className="admin-stats">

                <div className="admin-stat-card">
                    <span>Total Requests</span>
                    <strong>{stats.total}</strong>
                </div>

                <div className="admin-stat-card">
                    <span>Currently Open</span>
                    <strong>{stats.open}</strong>
                </div>

                <div className="admin-stat-card">
                    <span>Closed / Completed</span>
                    <strong>{stats.closed}</strong>
                </div>

                <div className="admin-stat-card link-card">
                    <span>Need filters, date ranges &amp; export?</span>
                    <Link to="/report">Open Reports →</Link>
                </div>

            </div>


            <div className="admin-section">

                <div className="admin-section-header">

                    <h2>All Requests</h2>

                    <div className="admin-search-field">
                        <label htmlFor="admin-request-id-search">Request ID</label>
                        <input
                            id="admin-request-id-search"
                            type="search"
                            value={requestIdSearch}
                            onChange={(event) => setRequestIdSearch(event.target.value)}
                            placeholder="Search request ID"
                        />
                    </div>

                </div>

                <div className="checker-table-container">

                    <table>

                        <thead>

                            <tr>
                                <th>Request ID</th>
                                <th>Maker</th>
                                <th>Department</th>
                                <th>Letter Type</th>
                                <th>Requested For</th>
                                <th>Current Bucket</th>
                                <th>Last Updated</th>
                                <th>Action</th>
                            </tr>

                        </thead>

                        <tbody>

                            {visibleRequests.length === 0 && (

                                <tr>
                                    <td colSpan={8} className="empty-row">
                                        No requests available.
                                    </td>
                                </tr>

                            )}

                            {visibleRequests.map((request) => (

                                <tr key={request.id}>

                                    <td>{request.id}</td>

                                    <td>
                                        {request.requestor?.employeeName}
                                        <span className="muted-id"> ({request.requestor?.employeeId})</span>
                                    </td>

                                    <td>{request.department}</td>

                                    <td>{request.letterType}</td>

                                    <td>{request.requestedFor}</td>

                                    <td>
                                        <span className="stage-badge">
                                            {STAGE_LABELS[request.status]}
                                        </span>
                                    </td>

                                    <td>{formatDateTime(request.updatedAt)}</td>

                                    <td>

                                        <button
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

            </div>


            <div className="admin-section">

                <div className="admin-section-header">

                    <h2>Users &amp; Roles</h2>

                    <div className="admin-search-field">
                        <label htmlFor="admin-user-employee-id-search">Employee ID</label>
                        <input
                            id="admin-user-employee-id-search"
                            type="search"
                            value={userEmployeeIdSearch}
                            onChange={(event) => setUserEmployeeIdSearch(event.target.value)}
                            placeholder="Search employee ID"
                        />
                    </div>

                </div>

                <div className="checker-table-container">

                    <table>

                        <thead>

                            <tr>
                                <th>Employee ID</th>
                                <th>Name</th>
                                <th>Department</th>
                                <th>Designation</th>
                                <th>Role</th>
                            </tr>

                        </thead>

                        <tbody>

                            {visibleEmployees.length === 0 && (

                                <tr>
                                    <td colSpan={5} className="empty-row">
                                        No employees available.
                                    </td>
                                </tr>

                            )}

                            {visibleEmployees.map((employee) => (

                                <tr key={employee.employee_id}>
                                    <td>{employee.employee_id}</td>
                                    <td>{employee.employee_name}</td>
                                    <td>{employee.department}</td>
                                    <td>{employee.designation}</td>
                                    <td>
                                        <span className="stage-badge">
                                            {employee.role_name}
                                        </span>
                                    </td>
                                </tr>

                            ))}

                        </tbody>

                    </table>

                </div>

            </div>


            <RequestDetailModal
                request={selectedRequest}
                onClose={() => setSelectedRequest(null)}
                title="Request Details (Admin View)"
            />

        </div>

    );

}


export default Admin;
