import React from "react";

import ReactDOM
    from "react-dom/client";


import App
    from "./App";


import {
    AuthProvider
} from "./context/AuthContext";


import {
    RequestsProvider
} from "./context/RequestsContext";


import {
    RevocationsProvider
} from "./context/RevocationsContext";


import "./index.css";


ReactDOM.createRoot(
    document.getElementById("root")
).render(

    <React.StrictMode>

        <AuthProvider>

            <RequestsProvider>

                <RevocationsProvider>

                    <App />

                </RevocationsProvider>

            </RequestsProvider>

        </AuthProvider>

    </React.StrictMode>

);