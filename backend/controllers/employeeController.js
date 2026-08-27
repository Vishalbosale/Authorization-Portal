const employeeModel = require("../models/employeeModel");

const getAllEmployees = async (req, res) => {

    if (req.session.user.role !== "ADMIN") {

        return res.status(403).json({
            message: "Admin access required."
        });

    }

    try {

        const employees = await employeeModel.getAllEmployees();

        res.json({
            success: true,
            data: employees
        });

    } catch (error) {

        console.error("GET EMPLOYEES ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch employees"
        });

    }

};

const getApprovers = async (req, res) => {

    try {

        const approvers = await employeeModel.getApproversByRole();

        res.json({
            success: true,
            data: approvers
        });

    } catch (error) {

        console.error("GET APPROVERS ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch approvers"
        });

    }

};

module.exports = {
    getAllEmployees,
    getApprovers
};
