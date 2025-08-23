// controllers/QuestionController.js
const Utils = require('./utils');

class QuestionController {
  constructor({ sequelize, Question, Option }) {
    this.sequelize = sequelize;
    this.Question = Question;
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
      if (req.query.sectionId) where.sectionId = req.query.sectionId;

      const { rows, count } = await this.Question.findAndCountAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'DESC']]
      });

      return res.json({ data: rows, total: count, limit, offset });
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  async get(req, res) {
    try {
      const id = req.params.id;
      const question = await this.Question.findByPk(id, {
        include: [{ model: this.Option, as: 'Options', separate: true, order: [['optionOrder', 'ASC']] }]
      });
      if (!question) return res.status(404).json({ error: 'NotFound' });
      return res.json({ data: question });
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  async create(req, res) {
    const t = await this.sequelize.transaction();
    try {
      const body = Utils.pick(req.body, [
        'sectionId',
        'questionText',
        'marks',
        'negativeMarks',
        'type',
        'metadata',
        'options'
      ]);
      if (!Object.prototype.hasOwnProperty.call(body, 'marks')) body.marks = 1;
      if (!Object.prototype.hasOwnProperty.call(body, 'negativeMarks')) body.negativeMarks = 0;
      if (!Object.prototype.hasOwnProperty.call(body, 'type')) body.type = 'single_correct';

      const question = await this.Question.create(
        Utils.pick(body, ['sectionId', 'questionText', 'marks', 'negativeMarks', 'type', 'metadata']),
        { transaction: t }
      );

      if (Array.isArray(body.options) && body.options.length) {
        const ops = body.options.map(o => ({
          questionId: question.id,
          optionText: o.optionText,
          isCorrect: Boolean(o.isCorrect),
          optionOrder: o.optionOrder
        }));
        await this.Option.bulkCreate(ops, { transaction: t });
      }

      await t.commit();
      return res.status(201).json({ data: question });
    } catch (err) {
      await t.rollback();
      return Utils.handleSequelizeError(err, res);
    }
  }

  async update(req, res) {
    try {
      const id = req.params.id;
      const question = await this.Question.findByPk(id);
      if (!question) return res.status(404).json({ error: 'NotFound' });

      const fields = ['questionText', 'marks', 'negativeMarks', 'type', 'metadata'];
      Object.assign(question, Utils.pick(req.body, fields));
      await question.save();
      return res.json({ data: question });
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  async remove(req, res) {
    try {
      const id = req.params.id;
      const deleted = await this.Question.destroy({ where: { id } });
      if (!deleted) return res.status(404).json({ error: 'NotFound' });
      return res.status(204).send();
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }
}

module.exports = QuestionController;
