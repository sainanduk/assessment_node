const express = require("express");
const db = require("../models");
const UserController = require("../controllers/UserController");

const router = express.Router();

const userCtrl = new UserController({
  sequelize: db.sequelize,
  Users: db.User,
});
// ---------- ROUTES ----------
// Prefix: /users
router.get("/users", userCtrl.list);
router.get("/users/:id", userCtrl.get);
router.post("/users", userCtrl.create);
router.put("/users/:id", userCtrl.update);
router.patch("/users/:id", userCtrl.update);
router.delete("/users/:id", userCtrl.remove);   

module.exports = router;