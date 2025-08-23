// routes/assessmentAssignment.js
const express = require('express');
const db = require('../models');
const AssessmentAssignmentController = require('../controllers/AssessmentAssignmentController');

const router = express.Router();

// Instantiate controller with dependencies
const assessmentAssignmentCtrl = new AssessmentAssignmentController({
  sequelize: db.sequelize,
  AssessmentAssignment: db.AssessmentAssignment,
  Assessment: db.Assessment,
  Institute: db.Institute,
  Batch: db.Batch
  , Attempt: db.Attempt // Assuming you have an Attempt model for tracking attempts
  , ProctoringSetting: db.ProctoringSetting
});

// Prefix: /assessment-assignments
router.get('/assessment-assignments', assessmentAssignmentCtrl.list);
router.get('/assessment-assignments/:id', assessmentAssignmentCtrl.get);
router.post('/assessment-assignments', assessmentAssignmentCtrl.create);
router.put('/assessment-assignments/:id', assessmentAssignmentCtrl.update);
router.patch('/assessment-assignments/:id', assessmentAssignmentCtrl.update);
router.delete('/assessment-assignments/:id', assessmentAssignmentCtrl.remove);

module.exports = router;
