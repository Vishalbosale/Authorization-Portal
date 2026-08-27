const bcrypt = require("bcrypt");
const pool = require("../config/db");


// =====================================================
// LOGIN
// =====================================================

const login = async (req, res) => {

    try {

        const {
            employeeId,
            password
        } = req.body;


        // -----------------------------
        // Validate input
        // -----------------------------

        if (typeof employeeId !== "string" ||
            typeof password !== "string" ||
            !employeeId.trim() ||
            !password) {

            return res.status(400).json({
                message:
                    "Employee ID and password are required."
            });

        }


        const ipAddress = req.ip;
        const userAgent = req.get("user-agent") || null;

        const recordLoginAttempt = async (status, failureReason) => {

            const [result] = await pool.execute(
                `
                INSERT INTO login_history
                (employee_id, ip_address, user_agent, status, failure_reason)
                VALUES (?, ?, ?, ?, ?)
                `,
                [employeeId, ipAddress, userAgent, status, failureReason || null]
            );

            return result.insertId;

        };


        // -----------------------------
        // Find employee
        // -----------------------------

        const [employees] = await pool.execute(
            `
            SELECT
                e.id,
                e.employee_id,
                e.employee_name,
                e.email,
                e.department,
                e.designation,
                e.password_hash,
                r.role_code AS role,
                r.role_name AS roleName,
                e.is_active
            FROM users e
            JOIN roles r ON r.id = e.role_id
            WHERE e.employee_id = ?
            LIMIT 1
            `,
            [employeeId]
        );


        // -----------------------------
        // Employee not found
        // -----------------------------

        if (employees.length === 0) {

            await recordLoginAttempt("FAILED", "Employee not found");

            return res.status(401).json({
                message:
                    "Invalid Employee ID or password."
            });

        }


        const employee = employees[0];


        // -----------------------------
        // Check active status
        // -----------------------------

        if (!employee.is_active) {

            await recordLoginAttempt("FAILED", "Employee inactive");

            return res.status(401).json({
                message:
                    "Invalid Employee ID or password."
            });
        }


        // -----------------------------
        // Compare password
        // -----------------------------

        const passwordMatch =
            await bcrypt.compare(
                password,
                employee.password_hash
            );


        if (!passwordMatch) {

            await recordLoginAttempt("FAILED", "Incorrect password");

            return res.status(401).json({
                message:
                    "Invalid Employee ID or password."
            });

        }


        // -----------------------------
        // Create session
        // -----------------------------

        await new Promise((resolve, reject) => {
            req.session.regenerate((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });

        const loginHistoryId =
            await recordLoginAttempt("SUCCESS");

        req.session.loginHistoryId = loginHistoryId;

        req.session.user = {

            id: employee.id,

            employeeId:
                employee.employee_id,

            employeeName:
                employee.employee_name,

            email:
                employee.email,

            department:
                employee.department,

            designation:
                employee.designation,

            role:
                employee.role,

            roleName:
                employee.roleName

        };


        // -----------------------------
        // Return user
        // -----------------------------

        return res.status(200).json({

            message:
                "Login successful.",

            user:
                req.session.user

        });


    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        return res.status(500).json({
            message:
                "Internal server error during login."
        });

    }

};


// =====================================================
// GET CURRENT USER
// =====================================================

const getCurrentUser = async (req, res) => {

    try {

        if (!req.session.user) {

            return res.status(401).json({
                message:
                    "Not authenticated."
            });

        }


        return res.status(200).json({

            user:
                req.session.user

        });

    } catch (error) {

        console.error(
            "GET USER ERROR:",
            error
        );

        return res.status(500).json({
            message:
                "Unable to retrieve user."
        });

    }

};


// =====================================================
// LOGOUT
// =====================================================

const logout = async (req, res) => {

    const loginHistoryId = req.session.loginHistoryId;

    if (loginHistoryId) {

        try {

            await pool.execute(
                `UPDATE login_history SET logout_time = NOW() WHERE id = ?`,
                [loginHistoryId]
            );

        } catch (error) {

            console.error(
                "LOGOUT HISTORY UPDATE ERROR:",
                error
            );

        }

    }

    req.session.destroy((error) => {

        if (error) {

            console.error(
                "LOGOUT ERROR:",
                error
            );

            return res.status(500).json({
                message:
                    "Logout failed."
            });

        }


        res.clearCookie(
            "connect.sid"
        );


        return res.status(200).json({
            message:
                "Logout successful."
        });

    });

};


module.exports = {
    login,
    getCurrentUser,
    logout
};