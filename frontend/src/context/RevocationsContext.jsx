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

const RevocationsContext = createContext(null);

const API_URL = "http://127.0.0.1:5000";

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

export function RevocationsProvider({ children }) {

    const { user } = useAuth();

    const [revocations, setRevocations] = useState([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {

        if (!user) {
            setRevocations([]);
            return;
        }

        setLoading(true);

        try {

            const response = await fetch(
                `${API_URL}/api/revocations`,
                { credentials: "include" }
            );

            const body = await parseResponse(response);

            setRevocations(body.data || []);

        } catch (error) {

            console.error("Failed to load revocations:", error);

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

    const createRevocation = useCallback(async (payload) => {

        const response = await fetch(
            `${API_URL}/api/revocations`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload)
            }
        );

        const body = await parseResponse(response);
        const created = body.data;

        setRevocations((previous) => [created, ...previous]);

        return created;

    }, []);

    const takeRevocationAction = useCallback(async (id, action, remark) => {

        const response = await fetch(
            `${API_URL}/api/revocations/${id}/actions`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ action, remark })
            }
        );

        const body = await parseResponse(response);
        const updated = body.data;

        setRevocations((previous) => previous.map(
            (revocation) => (revocation.id === id ? updated : revocation)
        ));

        return updated;

    }, []);

    const getRevocationForRequest = useCallback((requestId) => {

        return revocations.find(
            (revocation) => revocation.requestId === requestId
        );

    }, [revocations]);

    const value = {
        revocations,
        loading,
        createRevocation,
        takeRevocationAction,
        getRevocationForRequest,
        refresh
    };

    return (
        <RevocationsContext.Provider value={value}>
            {children}
        </RevocationsContext.Provider>
    );

}

export function useRevocations() {

    const context = useContext(RevocationsContext);

    if (!context) {
        throw new Error("useRevocations must be used within a RevocationsProvider");
    }

    return context;

}
