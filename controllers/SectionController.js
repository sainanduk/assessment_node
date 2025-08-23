// controllers/SectionController.js
const Utils = require('./utils');

class SectionController {
  constructor({ Section, Question, Option }) {
    this.Section = Section;
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
      if (req.query.assessmentId) where.assessmentId = req.query.assessmentId;

      const { rows, count } = await this.Section.findAndCountAll({
        where,
        limit,
        offset,
        order: [['sectionOrder', 'ASC']]
      });

      return res.json({ data: rows, total: count, limit, offset });
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  async get(req, res) {
    try {
      const id = req.params.id;
      const section = await this.Section.findByPk(id, {
        include: [
          {
            model: this.Question,
            as: 'Questions',
            include: [
              {
                model: this.Option,
                as: 'Options',
                separate: true,
                order: [['optionOrder', 'ASC']]
              }
            ]
          }
        ],
        order: [['sectionOrder', 'ASC']]
      });
      if (!section) return res.status(404).json({ error: 'NotFound' });
      return res.json({ data: section });
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  async create(req, res) {
    try {
      const payload = Utils.pick(req.body, [
        'assessmentId',
        'name',
        'description',
        'sectionOrder',
        'marks',
        'timeLimit',
        'instructions'
      ]);
      if (!Object.prototype.hasOwnProperty.call(payload, 'marks')) payload.marks = 0;
      const section = await this.Section.create(payload);
      return res.status(201).json({ data: section });
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  async update(req, res) {
    try {
      const id = req.params.id;
      const section = await this.Section.findByPk(id);
      if (!section) return res.status(404).json({ error: 'NotFound' });

      const fields = ['name', 'description', 'sectionOrder', 'marks', 'timeLimit', 'instructions'];
      Object.assign(section, Utils.pick(req.body, fields));
      await section.save();
      return res.json({ data: section });
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  async remove(req, res) {
    try {
      const id = req.params.id;
      const deleted = await this.Section.destroy({ where: { id } });
      if (!deleted) return res.status(404).json({ error: 'NotFound' });
      return res.status(204).send();
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }
}

module.exports = SectionController;
