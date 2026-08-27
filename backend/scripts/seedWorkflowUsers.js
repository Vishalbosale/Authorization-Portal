const bcrypt = require("bcrypt");
const pool = require("../config/db");

// One employee per workflow role. Credentials intentionally match the old
// frontend/src/data/users.js demo directory (now removed) so existing
// testers can keep using the same Employee ID / password pairs, now against
// the real backend.
const EMPLOYEES = [
    {
        employeeId: "500153",
        password: "Maker@123",
        employeeName: "Karthik Naik",
        email: "karthik.naik@authorizationportal.com",
        department: "IT",
        designation: "Software Engineer",
        roleCode: "MAKER"
    },
    {
        employeeId: "AFL2597",
        password: "Hod@123",
        employeeName: "Sam Marshall",
        email: "sam.marshall@authorizationportal.com",
        department: "IT",
        designation: "Head of Department",
        roleCode: "HOD"
    },
    {
        employeeId: "483687",
        password: "Ormd@123",
        employeeName: "Smitha Iyer",
        email: "smitha.iyer@authorizationportal.com",
        department: "ORMD",
        designation: "ORMD Head",
        roleCode: "ORMD_HEAD"
    },
    {
        employeeId: "EMP1004",
        password: "CooEd@123",
        employeeName: "Sanjay Patil",
        email: "sanjay.patil@authorizationportal.com",
        department: "Management",
        designation: "COO",
        roleCode: "COO_ED"
    },
    {
        employeeId: "EMP1003",
        password: "Secretarial@123",
        employeeName: "Priya Mehta",
        email: "priya.mehta@authorizationportal.com",
        department: "Secretarial",
        designation: "Secretarial Officer",
        roleCode: "SECRETARIAL"
    },
    {
        employeeId: "EMP9001",
        password: "Admin@123",
        employeeName: "Admin User",
        email: "admin.user@authorizationportal.com",
        department: "IT",
        designation: "System Administrator",
        roleCode: "ADMIN"
    }
];

const seedEmployees = async () => {

    try {

        const [roles] = await pool.execute(
            "SELECT id, role_code FROM roles"
        );

        const roleIdByCode = Object.fromEntries(
            roles.map((role) => [role.role_code, role.id])
        );

        console.log("=================================");

        for (const employee of EMPLOYEES) {

            const roleId = roleIdByCode[employee.roleCode];

            if (!roleId) {
                throw new Error(
                    `Role '${employee.roleCode}' not found - run database/03_insert_master_data.sql first.`
                );
            }

            const passwordHash = await bcrypt.hash(employee.password, 10);

            await pool.execute(
                `
                INSERT INTO users
                (employee_id, employee_name, email, department, designation, password_hash, role_id, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                `,
                [
                    employee.employeeId,
                    employee.employeeName,
                    employee.email,
                    employee.department,
                    employee.designation,
                    passwordHash,
                    roleId
                ]
            );

            console.log(
                `Created ${employee.roleCode}: ${employee.employeeId} / ${employee.password}`
            );

        }

        console.log("=================================");
        console.log("All workflow users created successfully.");
        console.log("=================================");

    } catch (error) {

        console.error("Error seeding employees:");
        console.error(error);

    } finally {

        await pool.end();

    }

};

seedEmployees();
