// routes/institutes.js
const express = require('express');
const db = require('../models');
const InstituteController = require('../controllers/instituteController');

const router = express.Router();

// Instantiate controller
const instituteCtrl = new InstituteController({
  sequelize: db.sequelize,
  Institute: db.Institute
});

// Prefix: /institutes
router.get('/institutes', instituteCtrl.list);
router.get('/institutes/:id', instituteCtrl.get);
router.post('/institutes', instituteCtrl.create);
router.put('/institutes/:id', instituteCtrl.update);
router.patch('/institutes/:id', instituteCtrl.update);
router.delete('/institutes/:id', instituteCtrl.remove);

module.exports = router;
