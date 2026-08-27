const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const db = require("./config/db");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS ||
    "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);


// ===============================
// Middleware
// ===============================

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(express.json({ limit: "1mb" }));

app.use(
    express.urlencoded({
        extended: false,
        limit: "1mb"
    })
);


// ===============================
// API Health Check
// ===============================

/*app.get("/api/health", (req, res) => {

    res.json({

        success: true,

        message:
            "Authorization Portal API is running"

    });

});   */

app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "OK",
        message: "Authorization Portal backend is running"
    });
});


// ===============================
// Database Health Check
// ===============================

app.get(
    "/api/health/database",
    async (req, res) => {

        try {

            const [rows] =
                await db.query(
                    "SELECT 1 AS result"
                );

            res.json({

                success: true,

                database: "Connected",

                result:
                    rows[0].result

            });

        } catch (error) {

            console.error("DATABASE HEALTH ERROR:", error);

            res.status(500).json({

                success: false,

                database: "Disconnected",

                message:
                    "Database health check failed"

            });

        }

    }
);


module.exports = app;
