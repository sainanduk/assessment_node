const { Op } = require("sequelize");
const Utils = require("./utils");
const redis = require("../config/redis");

class InstituteController {
  constructor({ sequelize, Institute }) {
    this.sequelize = sequelize;
    this.Institute = Institute;

    this.list = this.list.bind(this);
    this.get = this.get.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.remove = this.remove.bind(this);
  }

  // ---------- LIST ----------
  async list(req, res) {
    try {
      const cacheKey = `institutes:list:${JSON.stringify(req.query)}`;
      const cached = await redis.get(cacheKey);

      if (cached) return res.json(JSON.parse(cached));

      const { limit, offset } = Utils.parsePagination(req.query);
      const where = {};
      if (req.query.q) where.name = { [Op.iLike]: `%${req.query.q}%` };

      const { rows, count } = await this.Institute.findAndCountAll({
        where,
        limit,
        offset,
        order: [["id", "ASC"]],
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
      const id = req.params.id;
      const cacheKey = `institute:${id}`;
      const cached = await redis.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));

      const institute = await this.Institute.findByPk(id);
      if (!institute) return res.status(404).json({ error: "NotFound" });

      const response = { data: institute };
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
      const { name } = req.body;
      const institute = await this.Institute.create({ name }, { transaction: t });
      await t.commit();

      await redis.del("institutes:list:*");
      return res.status(201).json({ data: institute });
    } catch (err) {
      await t.rollback();
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- UPDATE ----------
  async update(req, res) {
    const t = await this.sequelize.transaction();
    try {
      const id = req.params.id;
      const institute = await this.Institute.findByPk(id, { transaction: t });
      if (!institute) {
        await t.rollback();
        return res.status(404).json({ error: "NotFound" });
      }

      Object.assign(institute, Utils.pick(req.body, ["name"]));
      await institute.save({ transaction: t });

      await t.commit();
      await redis.del(`institute:${id}`);
      await redis.del("institutes:list:*");

      return res.json({ data: institute });
    } catch (err) {
      await t.rollback();
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- REMOVE ----------
  async remove(req, res) {
    try {
      const id = req.params.id;
      const deleted = await this.Institute.destroy({ where: { id } });
      if (!deleted) return res.status(404).json({ error: "NotFound" });

      await redis.del(`institute:${id}`);
      await redis.del("institutes:list:*");

      return res.status(204).send();
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }
}

module.exports = InstituteController;
