import {
    useEffect
} from "react";


import {
    BrowserRouter,
    Routes,
    Route,
    useLocation
} from "react-router-dom";


import Header
    from "./components/Header/Header";


import Footer
    from "./components/Footer/Footer";


import ProtectedRoute
    from "./components/ProtectedRoute/ProtectedRoute";


import Home
    from "./pages/Home/Home";


import Login
    from "./pages/Login/Login";


import Request
    from "./pages/Request/Request";


import Workflow
    from "./pages/Workflow/Workflow";


import Checker
    from "./pages/Checker/Checker";


import Tracking
    from "./pages/Tracking/Tracking";


import Report
    from "./pages/Report/Report";


import Profile
    from "./pages/Profile/Profile";


import MyRequests
    from "./pages/MyRequests/MyRequests";


import Admin
    from "./pages/Admin/Admin";


import "./App.css";


function AppShell() {

    const location = useLocation();


    useEffect(() => {

        window.scrollTo({
            top: 0,
            behavior: "instant"
        });

    }, [location.pathname]);


    return (

        <div className="app-shell">

            <span
                key={`progress-${location.key}`}
                className="route-progress"
            />

            <Header />


            <main className="app-main">

                <div
                    key={location.pathname}
                    className="route-view"
                >

                    <Routes location={location}>


                        <Route
                            path="/"
                            element={
                                <Home />
                            }
                        />


                        <Route
                            path="/login"
                            element={
                                <Login />
                            }
                        />


                        <Route
                            path="/workflow"
                            element={
                                <Workflow />
                            }
                        />


                        <Route
                            path="/request"
                            element={

                                <ProtectedRoute>

                                    <Request />

                                </ProtectedRoute>

                            }
                        />


                        <Route
                            path="/checker"
                            element={

                                <ProtectedRoute>

                                    <Checker />

                                </ProtectedRoute>

                            }
                        />


                        {/* Alias of /checker that opens on the revocation
                            tab, so revoking is one click from the header. */}
                        <Route
                            path="/revocations"
                            element={

                                <ProtectedRoute>

                                    <Checker />

                                </ProtectedRoute>

                            }
                        />


                        <Route
                            path="/tracking"
                            element={

                                <ProtectedRoute>

                                    <Tracking />

                                </ProtectedRoute>

                            }
                        />


                        <Route
                            path="/report"
                            element={

                                <ProtectedRoute>

                                    <Report />

                                </ProtectedRoute>

                            }
                        />


                        <Route
                            path="/profile"
                            element={

                                <ProtectedRoute>

                                    <Profile />

                                </ProtectedRoute>

                            }
                        />


                        <Route
                            path="/my-requests"
                            element={

                                <ProtectedRoute>

                                    <MyRequests />

                                </ProtectedRoute>

                            }
                        />


                        <Route
                            path="/admin"
                            element={

                                <ProtectedRoute>

                                    <Admin />

                                </ProtectedRoute>

                            }
                        />


                    </Routes>

                </div>

            </main>


            <Footer />

        </div>

    );

}


function App() {

    return (

        <BrowserRouter>

            <AppShell />

        </BrowserRouter>

    );

}


export default App;
