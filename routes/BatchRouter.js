// routes/batches.js
const express = require('express');
const db = require('../models');
const BatchController = require('../controllers/BatchController');

const router = express.Router();

// Instantiate controller
const batchCtrl = new BatchController({
  sequelize: db.sequelize,
  Batch: db.Batch,
  Institute: db.Institute
});

// Prefix: /batches
router.get('/batches', batchCtrl.list);
router.get('/batches/by-institute/:instituteId', batchCtrl.listByInstitute);
router.get('/batches/:id', batchCtrl.get);
router.post('/batches', batchCtrl.create);
router.put('/batches/:id', batchCtrl.update);
router.patch('/batches/:id', batchCtrl.update);
router.delete('/batches/:id', batchCtrl.remove);

module.exports = router;
