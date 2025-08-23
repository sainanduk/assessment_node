const { Op } = require("sequelize");
const Utils = require("./utils");
const redis = require("../config/redis");

class UserController {
  constructor({ sequelize, Users }) {
    this.sequelize = sequelize;
    this.Users = Users;

    this.list = this.list.bind(this);
    this.get = this.get.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.remove = this.remove.bind(this);
  }

  // ---------- LIST ----------
  async list(req, res) {
    try {
      const cacheKey = `users:list:${JSON.stringify(req.query)}`;
      const cached = await redis.get(cacheKey);

      if (cached) return res.json(JSON.parse(cached));

      const { limit, offset } = Utils.parsePagination(req.query);
      const where = {};
      
      // Search functionality
      if (req.query.q) {
        where[Op.or] = [
          { username: { [Op.iLike]: `%${req.query.q}%` } },
          { email: { [Op.iLike]: `%${req.query.q}%` } }
        ];
      }

      // Filter by institute
      if (req.query.instituteId) {
        where.instituteId = req.query.instituteId;
      }

      // Filter by batch
      if (req.query.batchId) {
        where.batchId = req.query.batchId;
      }

      const { rows, count } = await this.Users.findAndCountAll({
        where,
        limit,
        offset,
        order: [["createdAt", "DESC"]],
      });

      const response = {
        data: rows,
        page: Math.floor(offset / limit) + 1,
        limit,
        total: count,
      };

      await redis.set(cacheKey, JSON.stringify(response), "EX", 60);
      return res.json(response);
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- GET ----------
  async get(req, res) {
    try {
      const userId = req.params.id;
      const cacheKey = `user:${userId}`;
      const cached = await redis.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));

      const user = await this.Users.findByPk(userId);
      if (!user) return res.status(404).json({ error: "NotFound" });

      const response = { data: user };
      await redis.set(cacheKey, JSON.stringify(response), "EX", 120);
      return res.json(response);
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- CREATE ----------
  async create(req, res) {
    const t = await this.sequelize.transaction();
    try {
      const { username, email, instituteId, batchId } = req.body;
      console.log("Creating user:", { username, email, instituteId, batchId });
      
      const user = await this.Users.create(
        { 
          username, 
          email, 
          instituteId, 
          batchId 
        }, 
        { transaction: t }
      );
      console.log("User created successfully:", user);
      
      await t.commit();

      // Clear cache
      await redis.del("users:list:*");
      
      return res.status(201).json({ data: user });
    } catch (err) {
      await t.rollback();
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- UPDATE ----------
  async update(req, res) {
    const t = await this.sequelize.transaction();
    try {
      const userId = req.params.id;
      const user = await this.Users.findByPk(userId, { transaction: t });
      
      if (!user) {
        await t.rollback();
        return res.status(404).json({ error: "NotFound" });
      }

      // Update allowed fields
      Object.assign(user, Utils.pick(req.body, ["username", "email", "instituteId", "batchId"]));
      await user.save({ transaction: t });

      await t.commit();
      
      // Clear cache
      await redis.del(`user:${userId}`);
      await redis.del("users:list:*");

      return res.json({ data: user });
    } catch (err) {
      await t.rollback();
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- REMOVE ----------
  async remove(req, res) {
    try {
      const userId = req.params.id;
      const deleted = await this.Users.destroy({ where: { userId } });
      
      if (!deleted) return res.status(404).json({ error: "NotFound" });

      // Clear cache
      await redis.del(`user:${userId}`);
      await redis.del("users:list:*");

      return res.status(204).send();
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }
}

module.exports = UserController;
