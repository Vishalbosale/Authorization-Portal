const db = require("../config/db");

const APPROVER_ROLES = ["HOD", "ORMD_HEAD", "COO_ED", "SECRETARIAL"];

const getAllEmployees = async () => {

    const [rows] = await db.execute(
        `
        SELECT
            e.employee_id,
            e.employee_name,
            e.email,
            e.department,
            e.designation,
            r.role_code,
            r.role_name,
            e.is_active
        FROM users e
        JOIN roles r ON r.id = e.role_id
        ORDER BY e.employee_name
        `
    );

    return rows;

};

const getApproversByRole = async () => {

    const [rows] = await db.execute(
        `
        SELECT
            e.employee_id,
            e.employee_name,
            r.role_code
        FROM users e
        JOIN roles r ON r.id = e.role_id
        WHERE r.role_code IN (?, ?, ?, ?)
          AND e.is_active = 1
        ORDER BY e.employee_name
        `,
        APPROVER_ROLES
    );

    const grouped = APPROVER_ROLES.reduce((acc, role) => {
        acc[role] = [];
        return acc;
    }, {});

    for (const row of rows) {
        grouped[row.role_code].push({
            employeeId: row.employee_id,
            employeeName: row.employee_name
        });
    }

    return grouped;

};

module.exports = {
    getAllEmployees,
    getApproversByRole
};
