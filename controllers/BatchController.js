const { Op } = require("sequelize");
const Utils = require("./utils");
const redis = require("../config/redis");

class BatchController {
  constructor({ sequelize, Batch, Institute }) {
    this.sequelize = sequelize;
    this.Batch = Batch;
    this.Institute = Institute;

    this.list = this.list.bind(this);
    this.get = this.get.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.remove = this.remove.bind(this);
    this.listByInstitute = this.listByInstitute.bind(this);
  }

  // ---------- LIST ----------
  async list(req, res) {
    try {
      const cacheKey = `batches:list:${JSON.stringify(req.query)}`;
      const cached = await redis.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));

      const { limit, offset } = Utils.parsePagination(req.query);
      const where = {};
      if (req.query.instituteId) where.instituteId = req.query.instituteId;
      if (req.query.q) where.name = { [Op.iLike]: `%${req.query.q}%` };

      const { rows, count } = await this.Batch.findAndCountAll({
        where,
        limit,
        offset,
        order: [["id", "ASC"]],
        include: [{ model: this.Institute, as: "Institute", attributes: ["id", "name"] }],
      });

      const response = { data: rows, page: Math.floor(offset / limit) + 1, limit, total: count };

      await redis.set(cacheKey, JSON.stringify(response), "EX", 60);
      return res.json(response);
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- LIST BY INSTITUTE ----------
  async listByInstitute(req, res) {
    try {
      const instituteId = req.params.instituteId || req.query.instituteId;
      if (!instituteId) {
        return res.status(400).json({ error: "MissingParameter", details: "instituteId is required" });
      }

      const cacheKey = `batches:byInstitute:${instituteId}:${JSON.stringify(req.query)}`;
      const cached = await redis.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));

      const { limit, offset } = Utils.parsePagination(req.query);
      const where = { instituteId };
      if (req.query.q) where.name = { [Op.iLike]: `%${req.query.q}%` };

      const { rows, count } = await this.Batch.findAndCountAll({
        where,
        limit,
        offset,
        order: [["id", "ASC"]],
        attributes: ["id", "name", "instituteId"],
        include: [{ model: this.Institute, as: "Institute", attributes: ["id", "name"] }],
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
      const cacheKey = `batch:${id}`;
      const cached = await redis.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));

      const batch = await this.Batch.findByPk(id, {
        include: [{ model: this.Institute, as: "Institute", attributes: ["id", "name"] }],
      });

      if (!batch) return res.status(404).json({ error: "NotFound" });

      const response = { data: batch };
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
      const { name, instituteId } = req.body;

      // Basic validation
      if (!name || !instituteId) {
        await t.rollback();
        return res.status(400).json({
          error: "ValidationError",
          details: "Both name and instituteId are required",
        });
      }

      const batch = await this.Batch.create({ name, instituteId }, { transaction: t });

      await t.commit();
      // Invalidate cache keys related to lists
      await redis.del("batches:list:*");
      await redis.del(`batches:byInstitute:${instituteId}:*`);

      return res.status(201).json({ data: batch });
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
      const batch = await this.Batch.findByPk(id, { transaction: t });
      if (!batch) {
        await t.rollback();
        return res.status(404).json({ error: "NotFound" });
      }

      const prevInstituteId = batch.instituteId;

      Object.assign(batch, Utils.pick(req.body, ["name", "instituteId"]));
      await batch.save({ transaction: t });

      await t.commit();

      // Invalidate caches
      await redis.del(`batch:${id}`);
      await redis.del("batches:list:*");
      await redis.del(`batches:byInstitute:${prevInstituteId}:*`);
      if (req.body.instituteId && req.body.instituteId !== prevInstituteId) {
        await redis.del(`batches:byInstitute:${req.body.instituteId}:*`);
      }

      return res.json({ data: batch });
    } catch (err) {
      await t.rollback();
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- REMOVE ----------
  async remove(req, res) {
    try {
      const id = req.params.id;
      const batch = await this.Batch.findByPk(id);
      if (!batch) return res.status(404).json({ error: "NotFound" });

      const instituteId = batch.instituteId;

      const deleted = await this.Batch.destroy({ where: { id } });
      if (!deleted) return res.status(404).json({ error: "NotFound" });

      // Invalidate caches
      await redis.del(`batch:${id}`);
      await redis.del("batches:list:*");
      await redis.del(`batches:byInstitute:${instituteId}:*`);

      return res.status(204).send();
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }
}

module.exports = BatchController;
