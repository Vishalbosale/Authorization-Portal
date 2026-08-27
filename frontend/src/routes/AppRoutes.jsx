import {
    Routes,
    Route
} from "react-router-dom";


import Home
    from "../pages/Home/Home";

import Request
    from "../pages/Request/Request";

import Workflow
    from "../pages/Workflow/Workflow";

import Checker
    from "../pages/Checker/Checker";

import Tracking
    from "../pages/Tracking/Tracking";

import Report
    from "../pages/Report/Report";

import Login
    from "../pages/Login/Login";


function AppRoutes() {

    return (

        <Routes>

            <Route
                path="/"
                element={<Home />}
            />

            <Route
                path="/request"
                element={<Request />}
            />

            <Route
                path="/workflow"
                element={<Workflow />}
            />

            <Route
                path="/checker"
                element={<Checker />}
            />

            <Route
                path="/tracking"
                element={<Tracking />}
            />

            <Route
                path="/report"
                element={<Report />}
            />

            <Route
                path="/login"
                element={<Login />}
            />

        </Routes>

    );

}


export default AppRoutes;