// controllers/AssessmentController.js
const { Op } = require('sequelize');
const Utils = require('./utils');
const redis = require('../config/redis'); // import your redis connection

class AssessmentController {
  constructor({ sequelize, Assessment, Section, Question, Option, ProctoringSetting, AssessmentAssignment }) {
    this.sequelize = sequelize;
    this.Assessment = Assessment;
    this.Section = Section;
    this.Question = Question;
    this.Option = Option;
    this.ProctoringSetting = ProctoringSetting;
    this.AssessmentAssignment = AssessmentAssignment;

    this.list = this.list.bind(this);
    this.get = this.get.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.remove = this.remove.bind(this);

    // NEW
    this.getMyAssessments = this.getMyAssessments.bind(this);
  }

  // ---------- LIST ----------
  async list(req, res) {
    try {
      const cacheKey = `assessments:list:${JSON.stringify(req.query)}`;
      const cached = await redis.get(cacheKey);

      if (cached) {
        return res.json(JSON.parse(cached));
      }

      const { limit, offset } = Utils.parsePagination(req.query);
      const where = {};
      if (req.query.status) where.status = req.query.status;
      if (req.query.q) where.title = { [Op.iLike]: `%${req.query.q}%` };
      if (req.query.startFrom || req.query.startTo) {
        where.startTime = {};
        if (req.query.startFrom) where.startTime[Op.gte] = new Date(req.query.startFrom);
        if (req.query.startTo) where.startTime[Op.lte] = new Date(req.query.startTo);
      }

      const { rows, count } = await this.Assessment.findAndCountAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'DESC']]
      });

      const response = {
        data: rows,
        page: Math.floor(offset / limit) + 1,
        limit,
        total: count
      };

      await redis.set(cacheKey, JSON.stringify(response), 'EX', 60); // cache for 1 min
      return res.json(response);
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- GET ----------
  async get(req, res) {
    try {
      const id = req.params.assessment_id;
      const batchId =1;
      const instituteId=1;
      const cacheKey = `assessment:${id}`;

      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
      console.log("this is assessment by id");
      
      console.log("Fetching assessment ID:", id);

      const assignments = await this.AssessmentAssignment.findAll({
        where: { assessmentId: id,batchId: batchId, instituteId: instituteId},
        attributes: ['id', 'instituteId', 'batchId', 'createdAt']
      });
      if (!assignments || assignments.length === 0) {
        return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this assessment' });
      }
      const assessment = await this.Assessment.findByPk(id, {
        attributes: { exclude: ['createdAt', 'updatedAt'] },
        include: [
          {
            model: this.Section,
            as: 'sections',
            attributes: { exclude: ['createdAt', 'updatedAt'] },
            separate: true,
            order: [['sectionOrder', 'ASC']],
            include: [
              {
                model: this.Question,
                as: 'questions',
                attributes: { exclude: ['createdAt', 'updatedAt'] },
                separate: true,
                include: [
                  {
                    model: this.Option,
                    as: 'options',
                    attributes: { exclude: ['isCorrect','questionId','createdAt', 'updatedAt'] },
                    separate: true,
                    order: [['optionOrder', 'ASC']]
                  }
                ]
              }
            ]
          },
          { 
            model: this.ProctoringSetting, 
            as: 'proctoring_settings',
            attributes: { exclude: ['createdAt', 'updatedAt'] }
          }
        ]
      });

      if (!assessment) return res.status(404).json({ error: 'NotFound' });

      const response = { data: assessment };
      await redis.set(cacheKey, JSON.stringify(response), 'EX', 120); // cache for 2 mins

      return res.json(response);
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- CREATE ----------
  async create(req, res) {
    const t = await this.sequelize.transaction();
    try {
      const { title, description, instructions, totalMarks = 0, duration, passing_score,
              status = 'draft', startTime, endTime, proctoring, sections } = req.body;

      const assessment = await this.Assessment.create(
        { title, description, instructions, totalMarks, duration, passing_score, status, startTime, endTime },
        { transaction: t }
      );

      if (proctoring) {
        await this.ProctoringSetting.create({ assessmentId: assessment.id, ...proctoring }, { transaction: t });
      }

      if (Array.isArray(sections) && sections.length) {
        for (const s of sections) {
          const section = await this.Section.create(
            { assessmentId: assessment.id, name: s.name, description: s.description, sectionOrder: s.sectionOrder, marks: s.marks ?? 0, timeLimit: s.timeLimit ?? null, instructions: s.instructions ?? null },
            { transaction: t }
          );

          if (Array.isArray(s.questions) && s.questions.length) {
            for (const q of s.questions) {
              const question = await this.Question.create(
                { sectionId: section.id, questionText: q.questionText, marks: q.marks ?? 1, negativeMarks: q.negativeMarks ?? 0, type: q.type ?? 'single_correct', metadata: q.metadata ?? null },
                { transaction: t }
              );

              if (Array.isArray(q.options) && q.options.length) {
                const ops = q.options.map(o => ({
                  questionId: question.id,
                  optionText: o.optionText,
                  isCorrect: Boolean(o.isCorrect),
                  optionOrder: o.optionOrder
                }));
                await this.Option.bulkCreate(ops, { transaction: t });
              }
            }
          }
        }
      }

      await t.commit();

      // 🔑 Invalidate relevant cache
      await redis.del('assessments:list:*');

      return res.status(201).json({ data: assessment });
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
      const assessment = await this.Assessment.findByPk(id, { transaction: t });
      if (!assessment) {
        await t.rollback();
        return res.status(404).json({ error: 'NotFound' });
      }

      const updatableFields = [
        'title','description','instructions','totalMarks','totalDuration','passingMarks','status','startTime','endTime'
      ];
      Object.assign(assessment, Utils.pick(req.body, updatableFields));
      await assessment.save({ transaction: t });

      if (Object.prototype.hasOwnProperty.call(req.body, 'proctoring')) {
        const existing = await this.ProctoringSetting.findOne({ where: { assessmentId: id }, transaction: t });
        if (existing) {
          await existing.update(req.body.proctoring || {}, { transaction: t });
        } else if (req.body.proctoring) {
          await this.ProctoringSetting.create({ assessmentId: id, ...req.body.proctoring }, { transaction: t });
        }
      }

      await t.commit();

      // 🔑 Invalidate cache for this assessment & lists
      await redis.del(`assessment:${id}`);
      await redis.del('assessments:list:*');
      // Also invalidate any user-scope caches that might include this assessment
      await redis.del('assessments:my:*');

      return res.json({ data: assessment });
    } catch (err) {
      await t.rollback();
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- REMOVE ----------
  async remove(req, res) {
    try {
      const id = req.params.id;
      const deleted = await this.Assessment.destroy({ where: { id } });
      if (!deleted) return res.status(404).json({ error: 'NotFound' });

      // 🔑 Invalidate cache
      await redis.del(`assessment:${id}`);
      await redis.del('assessments:list:*');
      await redis.del('assessments:my:*');

      return res.status(204).send();
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  async getMyAssessments(req, res) {
    try {
      const instituteId = req.body?.instituteId || req.query?.instituteId;
      const batchId = req.body?.batchId || req.query?.batchId;

      if (!instituteId || !batchId) {
        return res.status(400).json({ error: 'BadRequest', message: 'instituteId and batchId are required' });
      }

      // Optional filters (e.g., by status or time window)
      const { status, activeOnly } = req.query;
      const now = new Date();

      const cacheKey = `assessments:my:inst:${instituteId}:batch:${batchId}:status:${status || 'any'}:active:${activeOnly ? '1' : '0'}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      // Join AssessmentAssignment -> Assessment, filtered by instituteId & batchId
      const assignments = await this.AssessmentAssignment.findAll({
        where: { instituteId, batchId },
        attributes: ['id', 'assessmentId', 'instituteId', 'batchId', 'createdAt'],
        include: [
          {
            model: this.Assessment,
            as: 'assessment', // ensure association alias matches your model association
            attributes: ['id', 'title', 'status', 'startTime', 'endTime', 'totalDuration', 'totalMarks'],
            where: {
              ...(status ? { status } : {}),
              ...(activeOnly
                ? {
                    startTime: { [Op.lte]: now },
                    endTime: { [Op.gte]: now }
                  }
                : {})
            },
            required: true
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      // Shape: return only "basic assessment details"
      const data = assignments.map(a => ({
        id: a.assessment.id,
        title: a.assessment.title,
        status: a.assessment.status,
        startTime: a.assessment.startTime,
        endTime: a.assessment.endTime,
        totalDuration: a.assessment.totalDuration,
        totalMarks: a.assessment.totalMarks,
        // helpful assignment metadata (optional)
        assignmentId: a.id,
        assignedAt: a.createdAt
      }));

      const response = { data };

      // cache for 2 minutes
      await redis.set(cacheKey, JSON.stringify(response), 'EX', 120);

      return res.json(response);
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }
}

module.exports = AssessmentController;
