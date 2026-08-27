import {
    Navigate
} from "react-router-dom";


import {
    useAuth
} from "../../context/AuthContext";


function ProtectedRoute({
    children
}) {

    const {
        user,
        loading
    } = useAuth();


    if (loading) {

        return (

            <div className="route-loader">

                <span className="spinner" />

                <span>Checking your session...</span>

            </div>

        );

    }


    if (!user) {

        return (

            <Navigate
                to="/login"
                replace
            />

        );

    }


    return children;

}


export default ProtectedRoute;