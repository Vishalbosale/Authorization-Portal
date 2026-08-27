const express = require("express");

const {
    login,
    getCurrentUser,
    logout
} = require("../controllers/authController");

const createRouter = (loginLimiter) => {

    const router = express.Router();


    router.post("/login", loginLimiter, login);


    router.get("/me", getCurrentUser);


    router.post("/logout", logout);


    return router;
};

module.exports = createRouter;