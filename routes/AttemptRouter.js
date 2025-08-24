// routes/attempt.js
const express = require("express");
const db = require("../models");
const AttemptController = require("../controllers/AttemptController");

const router = express.Router();

// Instantiate controller with dependencies
const attemptCtrl = new AttemptController({
  sequelize: db.sequelize,
  Attempt: db.Attempt,
  AssessmentAssignment: db.AssessmentAssignment,
  Assessment: db.Assessment,
  User: db.User,
});

// ---------- ROUTES ----------
// Prefix: /attempts
router.get("/attempts", attemptCtrl.list);
router.get("/attempts/:id", attemptCtrl.get);
router.post("/attempts/:assessmentId", attemptCtrl.create);
router.post("/attempts/:id/submit", attemptCtrl.submit);      // special submit endpoint
router.patch("/attempts/:id/meta", attemptCtrl.updateMeta);   // update meta info
router.put("/attempts/:id/meta", attemptCtrl.updateMeta);     // allow PUT as well
router.delete("/attempts/:id", attemptCtrl.remove);

module.exports = router;
