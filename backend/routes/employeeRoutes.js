const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employeeController");

router.get("/", employeeController.getAllEmployees);
router.get("/approvers", employeeController.getApprovers);

module.exports = router;
