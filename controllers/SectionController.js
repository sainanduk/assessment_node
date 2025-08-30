// controllers/SectionController.js

class SectionController {
  constructor({ Section, Question, Option, QuestionBank, Assessment }) {
    this.Section = Section;
    this.Question = Question;
    this.Option = Option;
    this.Assessment = Assessment;
    this.QuestionBank = QuestionBank;

    this.list = this.list.bind(this);
    this.get = this.get.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.remove = this.remove.bind(this);
    this.sectionQuestions = this.sectionQuestions.bind(this);
  }

  // Helper function to pick specific fields from an object
  pick(obj, keys) {
    const result = {};
    keys.forEach(key => {
      if (obj.hasOwnProperty(key)) {
        result[key] = obj[key];
      }
    });
    return result;
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
      if (req.query.assessmentId) where.assessmentId = req.query.assessmentId;

      const { rows, count } = await this.Section.findAndCountAll({
        where,
        limit,
        offset,
        order: [['sectionOrder', 'ASC']]
      });

      return res.json({ data: rows, total: count, limit, offset });
    } catch (err) {
      return this.handleSequelizeError(err, res);
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
      return this.handleSequelizeError(err, res);
    }
  }

  async create(req, res) {
    try {
      const payload = this.pick(req.body, [
        'assessmentId',
        'name',
        'description',
        'sectionOrder',
        'marks',
        'timeLimit',
        'instructions',
        'question_count'
      ]);
      if (!Object.prototype.hasOwnProperty.call(payload, 'marks')) payload.marks = 0;
      const section = await this.Section.create(payload);
      return res.status(201).json({ data: section });
    } catch (err) {
      return this.handleSequelizeError(err, res);
    }
  }

  async update(req, res) {
    try {
      const id = req.params.id;
      const section = await this.Section.findByPk(id);
      if (!section) return res.status(404).json({ error: 'NotFound' });

      const fields = ['name', 'description', 'sectionOrder', 'marks', 'timeLimit', 'instructions', 'question_count'];
      Object.assign(section, this.pick(req.body, fields));
      await section.save();
      return res.json({ data: section });
    } catch (err) {
      return this.handleSequelizeError(err, res);
    }
  }

  async remove(req, res) {
    try {
      const id = req.params.id;
      const deleted = await this.Section.destroy({ where: { id } });
      if (!deleted) return res.status(404).json({ error: 'NotFound' });
      return res.status(204).send();
    } catch (err) {
      return this.handleSequelizeError(err, res);
    }
  }

  async sectionQuestions(req, res) {
    try {
      const { assessmentId, sectionId, difficulty, category } = req.body;
      const userId = req.user?.userId;
  
      //   Validate required parameters
      if (!assessmentId || !sectionId) {
        return res.status(400).json({ 
          error: 'Missing required parameters', 
          details: 'assessmentId and sectionId are required' 
        });
      }
  
      if (!userId) {
        return res.status(401).json({ 
          error: 'Unauthorized', 
          details: 'User authentication required' 
        });
      }
  
      //   Check assessment existence & ownership
      const assessment = await this.Assessment.findByPk(assessmentId);
      if (!assessment) {
        return res.status(404).json({ error: 'Assessment not found' });
      }
  
      if (assessment.createdBy !== userId) {
        return res.status(403).json({ 
          error: 'Forbidden', 
          details: 'You are not allowed to modify this assessment' 
        });
      }
  
      //   Get section
      const section = await this.Section.findOne({
        where: { id: sectionId, assessmentId: assessmentId }
      });
  
      if (!section) {
        return res.status(404).json({ error: 'Section not found' });
      }
  
      //   Ensure section type is noncoding
      if (section.type !== 'noncoding') {
        return res.status(400).json({ 
          error: 'Invalid section type', 
          details: 'Only noncoding sections can have questions from question bank' 
        });
      }
  
      //   Build filters for QuestionBank
      const questionBankWhere = {};
      if (difficulty) questionBankWhere.difficulty = difficulty;
      if (category) questionBankWhere.category = category;
  
      //   Fetch random questions
      const questionCount = section.question_count || 5; // default
      const marksPerQuestion = section.marks / questionCount;
  
      const questions = await this.QuestionBank.findAll({
        where: questionBankWhere,
        order: this.Section.sequelize.random(),
        limit: questionCount
      });
  
      if (!questions || questions.length === 0) {
        return res.status(404).json({ 
          error: 'No questions found', 
          details: 'No questions match the specified criteria' 
        });
      }
  
      //   Insert questions into section
      const createdQuestions = [];
      for (let i = 0; i < questions.length; i++) {
        const q = await this.Question.create({
          sectionId: sectionId,
          questionBankId: questions[i].id,
          questionOrder: i + 1,
          marks: marksPerQuestion,
          negativeMarks: questions[i].negativeMarks
        });
        createdQuestions.push(q);
      }
  
      return res.status(201).json({ 
        data: {
          section,
          questions: createdQuestions,
          totalQuestions: createdQuestions.length,
          marksPerQuestion
        },
        message: `Successfully added ${createdQuestions.length} questions to section`
      });
  
    } catch (err) {
      return this.handleSequelizeError(err, res);
    }
  }
  
}

module.exports = SectionController;
