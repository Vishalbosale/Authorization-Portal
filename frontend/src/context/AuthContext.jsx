import {
    createContext,
    useContext,
    useEffect,
    useState
} from "react";

const AuthContext = createContext(null);

// IMPORTANT:
// We are temporarily connecting directly to Node.
// This bypasses the Vite proxy.
const API_URL = "/api";

export const AuthProvider = ({ children }) => {

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);


    // ===============================
    // Check Existing Login
    // ===============================

    useEffect(() => {

        checkLogin();

    }, []);


    const checkLogin = async () => {

        try {

            const response = await fetch(
                `${API_URL}/api/auth/me`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );

            const contentType =
                response.headers.get("content-type");

            if (!response.ok) {

                if (
                    response.status === 401 ||
                    response.status === 403
                ) {
                    setUser(null);
                    return;
                }

                let message =
                    `Server returned HTTP ${response.status}`;

                if (
                    contentType &&
                    contentType.includes("application/json")
                ) {
                    const data = await response.json();
                    message =
                        data.message || message;
                }

                throw new Error(message);
            }

            if (
                contentType &&
                contentType.includes("application/json")
            ) {

                const data =
                    await response.json();

                setUser(data.user || null);

            } else {

                throw new Error(
                    "Backend did not return JSON."
                );

            }

        } catch (error) {

            console.error(
                "Authentication check error:",
                error
            );

            setUser(null);

        } finally {

            setLoading(false);

        }
    };


    // ===============================
    // Login
    // ===============================

    const login = async (
        employeeId,
        password
    ) => {

        try {

            const response = await fetch(
                `${API_URL}/api/auth/login`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({
                        employeeId,
                        password
                    })
                }
            );


            const contentType =
                response.headers.get("content-type");

            let data = null;


            if (
                contentType &&
                contentType.includes("application/json")
            ) {

                data =
                    await response.json();

            } else {

                const text =
                    await response.text();

                console.error(
                    "Non-JSON backend response:",
                    text
                );

                throw new Error(
                    `Server returned HTTP ${response.status}`
                );

            }


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Login failed."
                );

            }


            setUser(data.user);

            return data;

        } catch (error) {

            console.error(
                "Login error:",
                error
            );

            throw error;

        }

    };


    // ===============================
    // Logout
    // ===============================

    const logout = async () => {

        setUser(null);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        void fetch(
            `${API_URL}/api/auth/logout`,
            {
                method: "POST",
                credentials: "include",
                signal: controller.signal
            }
        )
            .catch((error) => {
                console.error("Logout error:", error);
            })
            .finally(() => {
                clearTimeout(timeoutId);
            });

    };


    return (

        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                logout
            }}
        >

            {children}

        </AuthContext.Provider>

    );

};


export const useAuth = () => {

    return useContext(AuthContext);

};