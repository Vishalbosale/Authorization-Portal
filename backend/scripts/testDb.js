const pool = require("../config/db");

async function testDatabase() {

    try {

        const connection =
            await pool.getConnection();

        console.log(
            "================================="
        );

        console.log(
            "MySQL connection successful!"
        );

        console.log(
            "Database:",
            process.env.DB_NAME
        );

        console.log(
            "User:",
            process.env.DB_USER
        );

        console.log(
            "================================="
        );

        connection.release();

    } catch (error) {

        console.error(
            "MySQL connection failed:"
        );

        console.error(error);

    } finally {

        await pool.end();

    }

}

testDatabase();