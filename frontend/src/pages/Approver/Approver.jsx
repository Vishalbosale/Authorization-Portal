import { useState } from "react";
import "./Approver.css";

function Approver() {

    const employees = [
        {
            id: "AFL2597",
            name: "Sam Marshall",
            designation: "Head of Department"
        },
        {
            id: "483687",
            name: "Smitha Iyer",
            designation: "ORMD Head"
        },
        {
            id: "EMP1003",
            name: "Priya Mehta",
            designation: "Secretarial"
        },
        {
            id: "EMP1004",
            name: "Sanjay Patil",
            designation: "COO"
        },
        {
            id: "EMP1005",
            name: "Neha Joshi",
            designation: "Executive Director"
        }
    ];


    const [approvers, setApprovers] = useState({

        HOD: {
            employeeId: "",
            name: ""
        },

        ORMD_HEAD: {
            employeeId: "",
            name: ""
        },

        SECRETARY: {
            employeeId: "",
            name: ""
        },

        COO_ED: {
            employeeId: "",
            name: ""
        }

    });


    const handleApproverChange = (
        type,
        employeeId
    ) => {

        const employee =
            employees.find(
                item =>
                    item.id === employeeId
            );


        setApprovers(
            previous => ({

                ...previous,

                [type]: {

                    employeeId:
                        employee?.id || "",

                    name:
                        employee?.name || ""

                }

            })
        );

    };


    const handleSave = () => {

        console.log(
            "Approver configuration:",
            approvers
        );

        alert(
            "Approver configuration saved successfully."
        );

    };


    const renderApproverRow = (
        type,
        label
    ) => {

        const selected =
            approvers[type];


        return (

            <div className="approver-row">

                <div className="approver-level">

                    <span className="level-badge">
                        {label}
                    </span>

                </div>


                <div className="approver-name">

                    <select
                        value={
                            selected.employeeId
                        }
                        onChange={
                            event =>
                                handleApproverChange(
                                    type,
                                    event.target.value
                                )
                        }
                    >

                        <option value="">
                            Select {label}
                        </option>


                        {employees.map(
                            employee => (

                                <option
                                    key={
                                        employee.id
                                    }
                                    value={
                                        employee.id
                                    }
                                >

                                    {employee.name}

                                </option>

                            )
                        )}

                    </select>

                </div>


                <div className="approver-id">

                    <input
                        type="text"
                        value={
                            selected.employeeId
                        }
                        placeholder="Employee ID"
                        readOnly
                    />

                </div>

            </div>

        );

    };


    return (

        <div className="approver-page">

            <div className="approver-container">


                <div className="approver-heading">

                    <h1>
                        Approver Management
                    </h1>

                    <p>
                        Select the default approver for each
                        authorization level. Secretarial does not
                        approve requests - it issues the AL / POA
                        letter once COO / ED gives final approval.
                    </p>

                </div>


                <div className="approver-card">


                    <div className="approver-header">

                        <div>
                            Approval Level
                        </div>

                        <div>
                            Approver Name
                        </div>

                        <div>
                            Employee ID
                        </div>

                    </div>


                    {renderApproverRow(
                        "HOD",
                        "HOD"
                    )}


                    {renderApproverRow(
                        "ORMD_HEAD",
                        "ORMD Head"
                    )}


                    {renderApproverRow(
                        "SECRETARY",
                        "Secretarial"
                    )}


                    {renderApproverRow(
                        "COO_ED",
                        "COO / ED"
                    )}


                    <div className="approver-actions">

                        <button
                            type="button"
                            onClick={handleSave}
                        >
                            Save Approvers
                        </button>

                    </div>

                </div>

            </div>

        </div>

    );

}

export default Approver;