// routes/question.js
const express = require("express");
const db = require("../models");
const QuestionController = require("../controllers/QuestionController");

const router = express.Router();

// Instantiate controller with dependencies
const questionCtrl = new QuestionController({
  sequelize: db.sequelize,
  Question: db.Question,
  Option: db.Option,
});

// ---------- ROUTES ----------
// Prefix: /questions
router.get("/questions", questionCtrl.list);
router.get("/questions/:id", questionCtrl.get);
router.post("/questions", questionCtrl.create);
router.put("/questions/:id", questionCtrl.update);
router.patch("/questions/:id", questionCtrl.update);
router.delete("/questions/:id", questionCtrl.remove);

module.exports = router;
