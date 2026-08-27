const bcrypt = require("bcrypt");
const pool = require("../config/db");

const createUser = async () => {

    try {

        const password = "Admin@123";

        const passwordHash =
            await bcrypt.hash(password, 10);


        const [roles] = await pool.execute(
            `SELECT id FROM roles WHERE role_code = ? LIMIT 1`,
            ["MAKER"]
        );

        if (roles.length === 0) {
            throw new Error(
                "Role 'MAKER' not found - run database/03_insert_master_data.sql first."
            );
        }

        const roleId = roles[0].id;


        const [result] = await pool.execute(
            `
            INSERT INTO users
            (
                employee_id,
                employee_name,
                email,
                department,
                designation,
                password_hash,
                role_id,
                is_active
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                "EMP0001",
                "Test Employee",
                "test@example.com",
                "IT",
                "Manager",
                passwordHash,
                roleId,
                1
            ]
        );


        console.log(
            "================================="
        );

        console.log(
            "Employee created successfully!"
        );

        console.log(
            "Employee ID: EMP0001"
        );

        console.log(
            "Password: Admin@123"
        );

        console.log(
            "Inserted ID:",
            result.insertId
        );

        console.log(
            "================================="
        );


    } catch (error) {

        console.error(
            "Error creating employee:"
        );

        console.error(error);

    } finally {

        await pool.end();

    }

};


createUser();