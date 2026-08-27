const express = require("express");
const cors = require("cors");
const session = require("express-session");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;
const sessionSecret = process.env.SESSION_SECRET;
const allowedOrigins = (process.env.CORS_ORIGINS ||
    "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters.");
}


// ==========================================
// CORS
// ==========================================

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));


// ==========================================
// JSON
// ==========================================

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: false, limit: "15mb" }));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many login attempts. Please try again later." }
});

app.use("/api", apiLimiter);


// ==========================================
// SESSION
// ==========================================

app.use(
    session({

        secret: sessionSecret,

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 8
        }

    })
);


// ==========================================
// ROUTES
// ==========================================

const authRoutes =
    require("./routes/authRoutes");
const requestRoutes = require("./routes/requestRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const revocationRoutes = require("./routes/revocationRoutes");


app.use(
    "/api/auth",
    authRoutes(loginLimiter)
);

const requireAuth = require("./middleware/authMiddleware");
app.use("/api/requests", requireAuth, requestRoutes);
app.use("/api/employees", requireAuth, employeeRoutes);
app.use("/api/revocations", requireAuth, revocationRoutes);


// ==========================================
// ROOT
// ==========================================

app.get("/", (req, res) => {

    res.json({
        message:
            "Authorization Portal Backend is running."
    });

});


// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {

    res.status(200).json({
        status: "OK",
        message: "Authorization Portal Backend is running."
    });

});


// ==========================================
// SERVER
// ==========================================

app.listen(
    PORT,
    "127.0.0.1",
    () => {

        console.log(
            `Backend running at http://127.0.0.1:${PORT}`
        );

    }
);
