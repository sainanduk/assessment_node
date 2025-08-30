// routes/question.js
const express = require("express");
const db = require("../models");
const QuestionController = require("../controllers/QuestionController");

// Debug: Check what's being imported
// console.log("Available models:", Object.keys(db));
// console.log("QuestionBank:", db.QuestionBank);
// console.log("Option:", db.Option);

const router = express.Router();

// Instantiate controller with dependencies
const questionCtrl = new QuestionController({
  sequelize: db.sequelize,
  QuestionBank: db.QuestionBank,
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
