// routes/option.js
const express = require("express");
const db = require("../models");
const OptionController = require("../controllers/OptionController");

const router = express.Router();

// Instantiate controller with dependencies
const optionCtrl = new OptionController({
  Option: db.Option,
});

// ---------- ROUTES ----------
// Prefix: /options
router.get("/options", optionCtrl.list);
router.get("/options/:id", optionCtrl.get);
router.post("/options", optionCtrl.create);
router.put("/options/:id", optionCtrl.update);
router.patch("/options/:id", optionCtrl.update);
router.delete("/options/:id", optionCtrl.remove);

module.exports = router;
