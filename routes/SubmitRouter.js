// routes/SubmitRouter.js
const express = require('express');
const db = require('../models');
const SubmissionController = require('../controllers/submitController');

const router = express.Router();

// Instantiate controller with dependencies
const submissionCtrl = new SubmissionController({
  sequelize: db.sequelize,
  Submission: db.Submission,
  Attempt: db.Attempt,
  Assessment: db.Assessment,
  Section: db.Section,
  Question: db.Question,
  Option: db.Option,
  QuestionBank: db.QuestionBank,
  Report: db.Report
});

// Submission routes
router.post('/submissions', submissionCtrl.create);
router.get('/submissions/attempt/:attemptId', submissionCtrl.getByAttempt);
router.post('/submissions/final-submit', submissionCtrl.finalSubmit);

module.exports = router;
