const express = require("express");
const router = express.Router();
const requestController = require("../controllers/requestController");

router.get("/", requestController.getRequests);
router.get("/:id", requestController.getRequestById);
router.post("/", requestController.createRequest);
router.post("/:id/actions", requestController.takeAction);
router.post("/:id/resubmit", requestController.resubmitRequest);

module.exports = router;
