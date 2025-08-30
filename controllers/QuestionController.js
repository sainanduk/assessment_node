// controllers/QuestionController.js

class QuestionController {
  constructor({ sequelize, QuestionBank, Option }) {
    console.log("QuestionController constructor called with:", { sequelize: !!sequelize, QuestionBank: !!QuestionBank, Option: !!Option });
    this.sequelize = sequelize;
    this.QuestionBank = QuestionBank;
    this.Option = Option;
    console.log("QuestionController constructor: ", sequelize, QuestionBank, Option);
    this.list = this.list.bind(this);
    this.get = this.get.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.remove = this.remove.bind(this);
  }

  // Helper function to parse pagination
  parsePagination(query) {
    const limit = parseInt(query.limit) || 10;
    const offset = parseInt(query.offset) || 0;
    return { limit, offset };
  }

  // Helper function to handle Sequelize errors
  handleSequelizeError(err, res) {
    console.error('Database error:', err);
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        error: 'Validation Error', 
        details: err.errors.map(e => ({ field: e.path, message: e.message }))
      });
    }
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ 
        error: 'Duplicate Entry', 
        details: err.errors.map(e => ({ field: e.path, message: e.message }))
      });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }

  async list(req, res) {
    try {
      const { limit, offset } = this.parsePagination(req.query);
      const where = {};
      if (req.query.sectionId) where.sectionId = req.query.sectionId;

      const { rows, count } = await this.QuestionBank.findAndCountAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'DESC']]
      });

      return res.json({ data: rows, total: count, limit, offset });
    } catch (err) {
      return this.handleSequelizeError(err, res);
    }
  }

  async get(req, res) {
    try {
      const id = req.params.id;
      const question = await this.QuestionBank.findByPk(id, {
        include: [{ model: this.Option, as: 'options', separate: true, order: [['optionOrder', 'ASC']] }]
      });
      if (!question) return res.status(404).json({ error: 'NotFound' });
      return res.json({ data: question });
    } catch (err) {
      return this.handleSequelizeError(err, res);
    }
  }

  async create(req, res) {
    const t = await this.sequelize.transaction();
    try {
      const body = req.body;
  
      //   Basic validations
      if (!body.questionText || typeof body.questionText !== "string" || !body.questionText.trim()) {
        return res.status(400).json({ error: "Question text is required" });
      }
  
      if (body.type && !['single_correct', 'multi_correct'].includes(body.type)) {
        return res.status(400).json({ error: "Invalid type. Must be 'single_correct' or 'multi_correct'" });
      }
  
      if (body.difficulty && !['easy', 'medium', 'hard'].includes(body.difficulty)) {
        return res.status(400).json({ error: "Invalid difficulty. Must be 'easy', 'medium', or 'hard'" });
      }
  
      if (body.marks !== undefined && (isNaN(body.marks) || body.marks < 0)) {
        return res.status(400).json({ error: "Marks must be a non-negative number" });
      }
  
      if (body.negativeMarks !== undefined && (isNaN(body.negativeMarks) || body.negativeMarks < 0)) {
        return res.status(400).json({ error: "Negative marks must be a non-negative number" });
      }
  
      if (body.tags && !Array.isArray(body.tags)) {
        return res.status(400).json({ error: "Tags must be an array" });
      }
  
      //   Build question data
      const questionData = {
        questionText: body.questionText.trim(),
        type: body.type ?? 'single_correct',
        difficulty: body.difficulty ?? null,
        category: body.category ?? null,
        tags: body.tags ?? null
      };
  
      //   Insert QuestionBank entry
      const question = await this.QuestionBank.create(questionData, { transaction: t });
  
      //   Insert options if provided
      if (Array.isArray(body.options) && body.options.length) {
        const ops = body.options.map((o, idx) => {
          if (!o.optionText || typeof o.optionText !== "string") {
            throw new Error("Each option must have valid 'optionText'");
          }
          return {
            questionBankId: question.id,
            optionText: o.optionText.trim(),
            isCorrect: Boolean(o.isCorrect),
            optionOrder: o.optionOrder ?? idx + 1
          };
        });
        await this.Option.bulkCreate(ops, { transaction: t });
      }
  
      await t.commit();
      return res.status(201).json({ data: question });
    } catch (err) {
      await t.rollback();
  
      // Catch custom thrown validation errors from options
      if (err.message && err.message.startsWith("Each option")) {
        return res.status(400).json({ error: err.message });
      }
  
      return this.handleSequelizeError(err, res);
    }
  }
  

  async update(req, res) {
    try {
      const id = req.params.id;
      const question = await this.QuestionBank.findByPk(id);
      if (!question) return res.status(404).json({ error: 'NotFound' });

      const body = req.body;

      if (body.questionText !== undefined) question.questionText = body.questionText;
      if (body.marks !== undefined) question.marks = body.marks;
      if (body.negativeMarks !== undefined) question.negativeMarks = body.negativeMarks;
      if (body.type !== undefined) question.type = body.type;
      if (body.metadata !== undefined) question.metadata = body.metadata;

      await question.save();
      return res.json({ data: question });
    } catch (err) {
      return this.handleSequelizeError(err, res);
    }
  }

  async remove(req, res) {
    try {
      const id = req.params.id;
      const deleted = await this.QuestionBank.destroy({ where: { id } });
      if (!deleted) return res.status(404).json({ error: 'NotFound' });
      return res.status(204).send();
    } catch (err) {
      return this.handleSequelizeError(err, res);
    }
  }
}

module.exports = QuestionController;
