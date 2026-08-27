import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState
} from "react";

import {
    useAuth
} from "./AuthContext";

const RequestsContext = createContext(null);

const API_URL = "/api";

async function parseResponse(response) {

    const contentType = response.headers.get("content-type");

    const body = contentType && contentType.includes("application/json")
        ? await response.json()
        : null;

    if (!response.ok) {
        throw new Error(body?.message || `Server returned HTTP ${response.status}`);
    }

    return body;

}

export function RequestsProvider({ children }) {

    const { user } = useAuth();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {

        if (!user) {
            setRequests([]);
            return;
        }

        setLoading(true);

        try {

            const response = await fetch(
                `${API_URL}/api/requests`,
                { credentials: "include" }
            );

            const body = await parseResponse(response);

            setRequests(body.data || []);

        } catch (error) {

            console.error("Failed to load requests:", error);

        } finally {

            setLoading(false);

        }

    }, [user]);

    useEffect(() => {

        // refresh() only calls setState after an awaited fetch resolves, not
        // synchronously - this is the standard fetch-on-mount pattern.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        refresh();

    }, [refresh]);

    const createRequest = useCallback(async (payload) => {

        const response = await fetch(
            `${API_URL}/api/requests`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload)
            }
        );

        const body = await parseResponse(response);
        const created = body.data;

        setRequests((previous) => [created, ...previous]);

        return created;

    }, []);

    const resubmitRequest = useCallback(async (id, payload) => {

        const response = await fetch(
            `${API_URL}/api/requests/${id}/resubmit`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload)
            }
        );

        const body = await parseResponse(response);
        const updated = body.data;

        setRequests((previous) => previous.map(
            (request) => (request.id === id ? updated : request)
        ));

        return updated;

    }, []);

    const takeAction = useCallback(async (id, action, { remark, extra } = {}) => {

        const response = await fetch(
            `${API_URL}/api/requests/${id}/actions`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ action, remark, extra })
            }
        );

        const body = await parseResponse(response);
        const updated = body.data;

        setRequests((previous) => previous.map(
            (request) => (request.id === id ? updated : request)
        ));

        return updated;

    }, []);

    const withdrawRequest = useCallback(async (id, actor, remark) => {

        return takeAction(id, "MAKER_WITHDRAW", { remark });

    }, [takeAction]);

    const getRequest = useCallback((id) => {

        return requests.find(
            (request) => request.id.toLowerCase() === String(id).toLowerCase()
        );

    }, [requests]);

    const value = {
        requests,
        loading,
        createRequest,
        resubmitRequest,
        takeAction,
        withdrawRequest,
        getRequest,
        refresh
    };

    return (
        <RequestsContext.Provider value={value}>
            {children}
        </RequestsContext.Provider>
    );

}

export function useRequests() {

    const context = useContext(RequestsContext);

    if (!context) {
        throw new Error("useRequests must be used within a RequestsProvider");
    }

    return context;

}
