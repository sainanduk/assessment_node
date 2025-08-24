// routes/index.js
const express = require('express');
const db = require('../models');

const AssessmentController = require('../controllers/AssessmentController');
const SectionController = require('../controllers/SectionController');
const QuestionController = require('../controllers/QuestionController');
const OptionController = require('../controllers/OptionController');

const router = express.Router();

// Instantiate controllers with dependencies
const assessmentCtrl = new AssessmentController({
  sequelize: db.sequelize,
  Assessment: db.Assessment,
  Section: db.Section,
  Question: db.Question,
  Option: db.Option,
  ProctoringSetting: db.ProctoringSetting,
  AssessmentAssignment: db.AssessmentAssignment
});

const sectionCtrl = new SectionController({
  Section: db.Section,
  Question: db.Question,
  Option: db.Option
});

const questionCtrl = new QuestionController({
  sequelize: db.sequelize,
  Question: db.Question,
  Option: db.Option
});

const optionCtrl = new OptionController({
  Option: db.Option
});

// Assessment routes
router.get('/assessments', assessmentCtrl.list);
router.get('/assessments/:assessment_id', assessmentCtrl.get);
router.post('/assessments', assessmentCtrl.create);
router.put('/assessments/:id', assessmentCtrl.update);
router.patch('/assessments/:id', assessmentCtrl.update);
router.delete('/assessments/:id', assessmentCtrl.remove);

// Section routes
router.get('/sections', sectionCtrl.list);
router.get('/sections/:id', sectionCtrl.get);
router.post('/sections', sectionCtrl.create);
router.put('/sections/:id', sectionCtrl.update);
router.patch('/sections/:id', sectionCtrl.update);
router.delete('/sections/:id', sectionCtrl.remove);

// Question routes
router.get('/questions', questionCtrl.list);
router.get('/questions/:id', questionCtrl.get);
router.post('/questions', questionCtrl.create);
router.put('/questions/:id', questionCtrl.update);
router.patch('/questions/:id', questionCtrl.update);
router.delete('/questions/:id', questionCtrl.remove);

// Option routes
router.get('/options', optionCtrl.list);
router.get('/options/:id', optionCtrl.get);
router.post('/options', optionCtrl.create);
router.put('/options/:id', optionCtrl.update);
router.patch('/options/:id', optionCtrl.update);
router.delete('/options/:id', optionCtrl.remove);

module.exports = router;
