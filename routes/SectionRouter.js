// routes/section.js
const express = require("express");
const db = require("../models");
const SectionController = require("../controllers/SectionController");

const router = express.Router();

// Instantiate controller with dependencies
const sectionCtrl = new SectionController({
  Section: db.Section,
  Question: db.Question,
  Option: db.Option,
  QuestionBank: db.QuestionBank,
});

// ---------- ROUTES ----------
// Prefix: /sections
router.get("/sections", sectionCtrl.list);
router.get("/sections/:id", sectionCtrl.get);
router.post("/sections", sectionCtrl.create);
router.put("/sections/:id", sectionCtrl.update);
router.patch("/sections/:id", sectionCtrl.update);
router.delete("/sections/:id", sectionCtrl.remove);

// New route for adding questions to section from question bank
router.post("/sections/questions", sectionCtrl.sectionQuestions);

module.exports = router;
