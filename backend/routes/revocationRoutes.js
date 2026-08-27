const express = require("express");
const router = express.Router();
const revocationController = require("../controllers/revocationController");

router.get("/", revocationController.getRevocations);
router.post("/", revocationController.createRevocation);
router.post("/:id/actions", revocationController.takeAction);

module.exports = router;
