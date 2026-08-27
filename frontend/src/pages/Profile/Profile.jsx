import {
    useAuth
} from "../../context/AuthContext";


import "./Profile.css";


function Profile() {

    const { user } =
        useAuth();


    if (!user) {

        return null;

    }


    return (

        <div className="profile-page">


            <div className="profile-header">

                <div className="large-avatar">

                    {
                        user.employeeName
                            ?.charAt(0)
                            .toUpperCase()
                    }

                </div>


                <div>

                    <h1>
                        {
                            user.employeeName
                        }
                    </h1>

                    <p>
                        {
                            user.employeeId
                        }
                    </p>

                </div>

            </div>


            <div className="profile-card">


                <h2>
                    Employee Information
                </h2>


                <div className="profile-grid">


                    <div>

                        <span>
                            Employee ID
                        </span>

                        <strong>
                            {
                                user.employeeId
                            }
                        </strong>

                    </div>


                    <div>

                        <span>
                            Employee Name
                        </span>

                        <strong>
                            {
                                user.employeeName
                            }
                        </strong>

                    </div>


                    <div>

                        <span>
                            Email
                        </span>

                        <strong>
                            {
                                user.email ||
                                "-"
                            }
                        </strong>

                    </div>


                    <div>

                        <span>
                            Department
                        </span>

                        <strong>
                            {
                                user.department ||
                                "-"
                            }
                        </strong>

                    </div>


                    <div>

                        <span>
                            Designation
                        </span>

                        <strong>
                            {
                                user.designation ||
                                "-"
                            }
                        </strong>

                    </div>


                    <div>

                        <span>
                            Role
                        </span>

                        <strong>
                            {
                                user.roleName ||
                                user.role ||
                                "USER"
                            }
                        </strong>

                    </div>


                </div>

            </div>

        </div>

    );

}


export default Profile;