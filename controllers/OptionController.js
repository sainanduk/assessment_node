// controllers/OptionController.js
const Utils = require('./utils');

class OptionController {
  constructor({ Option }) {
    this.Option = Option;

    this.list = this.list.bind(this);
    this.get = this.get.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.remove = this.remove.bind(this);
  }

  async list(req, res) {
    try {
      const { limit, offset } = Utils.parsePagination(req.query);
      const where = {};
      if (req.query.questionId) where.questionId = req.query.questionId;

      const { rows, count } = await this.Option.findAndCountAll({
        where,
        limit,
        offset,
        order: [['optionOrder', 'ASC']]
      });

      return res.json({ data: rows, total: count, limit, offset });
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  async get(req, res) {
    try {
      const id = req.params.id;
      const option = await this.Option.findByPk(id);
      if (!option) return res.status(404).json({ error: 'NotFound' });
      return res.json({ data: option });
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  async create(req, res) {
    try {
      const payload = Utils.pick(req.body, ['questionId', 'optionText', 'isCorrect', 'optionOrder']);
      payload.isCorrect = Boolean(payload.isCorrect);
      const option = await this.Option.create(payload);
      return res.status(201).json({ data: option });
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  async update(req, res) {
    try {
      const id = req.params.id;
      const option = await this.Option.findByPk(id);
      if (!option) return res.status(404).json({ error: 'NotFound' });

      const fields = ['optionText', 'isCorrect', 'optionOrder'];
      Object.assign(option, Utils.pick(req.body, fields));
      if (Object.prototype.hasOwnProperty.call(req.body, 'isCorrect')) {
        option.isCorrect = Boolean(req.body.isCorrect);
      }
      await option.save();
      return res.json({ data: option });
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  async remove(req, res) {
    try {
      const id = req.params.id;
      const deleted = await this.Option.destroy({ where: { id } });
      if (!deleted) return res.status(404).json({ error: 'NotFound' });
      return res.status(204).send();
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }
}

module.exports = OptionController;
