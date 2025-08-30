// controllers/AssessmentController.js
const { Op } = require('sequelize');
const Utils = require('./utils');
const redis = require('../config/redis'); // import your redis connection

class AssessmentController {
  constructor({ sequelize, Assessment, Section, Question, Option, ProctoringSetting, QuestionBank }) {
    this.sequelize = sequelize;
    this.Assessment = Assessment;
    this.Section = Section;
    this.Question = Question;
    this.Option = Option;
    this.ProctoringSetting = ProctoringSetting;
    this.QuestionBank = QuestionBank;

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
      const { limit, offset } = Utils.parsePagination(req.query);

      // Build cache key with pagination + filters
      const cacheKey = `assessments:list:${req.user.batchId}:${req.user.instituteId}:${limit}:${offset}:${req.query.status || ''}:${req.query.q || ''}:${req.query.startFrom || ''}:${req.query.startTo || ''}`;

      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
      console.log("Not cached");

      // Build filters
      const where = {};
      if (req.query.status) where.status = req.query.status;
      if (req.query.q) where.title = { [Op.iLike]: `%${req.query.q}%` };
      if (req.query.startFrom || req.query.startTo) {
        where.startTime = {};
        if (req.query.startFrom) where.startTime[Op.gte] = new Date(req.query.startFrom);
        if (req.query.startTo) where.startTime[Op.lte] = new Date(req.query.startTo);
      }
      where.type = "assessment";

      // Fetch from DB
      const { rows, count } = await this.Assessment.findAndCountAll({
        where,
        limit,
        offset,
        attributes: {
          exclude: [
            "instituteId",
            "batchId",
            "status",
            "show_results",
            "createdBy",
            "createdAt",
            "updatedAt",
            "type",
            "shuffle_questions",
            "shuffle_options"
          ]
        },
        order: [["createdAt", "DESC"]]
      });

      console.log("Assessments list:", rows);

      const response = {
        data: rows,
        page: Math.floor(offset / limit) + 1,
        limit,
        total: count
      };

      // Cache the response for 1 minute
      await redis.set(cacheKey, JSON.stringify(response), "EX", 60);

      return res.json(response);
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }


  // ---------- GET ----------
  async get(req, res) {
    try {
      const id = req.params.assessment_id;
      const cacheKey = `assessment:${id}:${req.user.batchId}:${req.user.instituteId}`;

      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
      console.log("this is assessment by id");

      console.log("Fetching assessment ID:", id);
      const assessment = await this.Assessment.findOne({where: {id, batchId: req.user.batchId, instituteId: req.user.instituteId}, 
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
                    model: this.QuestionBank,
                    as: 'questionBank',
                    attributes: { exclude: ['createdAt', 'updatedAt'] },
                    include: [
                      {
                        model: this.Option,
                        as: 'options',
                        attributes: { exclude: ['createdAt', 'updatedAt'] },
                        order: [['optionOrder', 'ASC']]
                      }
                    ]
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
    const userId = req.user.userId;
    try {
      const {
        title, description, instructions, totalMarks = 0, duration, passing_score,
        status = 'draft', startTime, endTime, proctoring, sections, instituteId, batchId, section_time_limit
      } = req.body;

      if (!title || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ success: false, message: "Title is required." });
      }

      if (!duration || typeof duration !== "number" || duration <= 0) {
        return res.status(400).json({ success: false, message: "Duration must be a positive number (in minutes)." });
      }

      if (!startTime || !endTime) {
        return res.status(400).json({ success: false, message: "Start time and end time are required." });
      }

      const now = new Date(new Date()+ 5.5 * 60 * 60 * 1000);
      const start = new Date(startTime);
      const end = new Date(endTime);


      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid start or end time format." });
      }

      if (start <= now) {
        return res.status(400).json({ success: false, message: "Start time must be in the future." });
      }

      if (end <= start) {
        return res.status(400).json({ success: false, message: "End time must be after start time." });
      }

      const expectedDuration = Math.floor((end - start) / (1000 * 60)); // in minutes
      if (duration !== expectedDuration) {
        return res.status(400).json({
          success: false,
          message: `Duration mismatch. Duration must equal the difference between start and end time (${expectedDuration} minutes).`
        });
      }
      if (!sections || sections.length <= 0) {
        return res.status(400).json({ success: false, message: "Atleast one section should be present" });
      }
      if (totalMarks <= 0) {
        return res.status(400).json({ success: false, message: "Total marks must be greater than 0" });
      }
      if (passing_score <= 0) {
        return res.status(400).json({ success: false, message: "Passing score must be greater than 0" });
      }
      if (passing_score > totalMarks) {
        return res.status(400).json({ success: false, message: "Passing score must be less than total marks" });
      }


      // ✅ Create Assessment
      const assessment = await this.Assessment.create(
        { title, description, instructions, totalMarks, duration, passing_score, section_count: sections.length, status, startTime: start, endTime: end, createdBy: userId, instituteId, batchId },
        { transaction: t }
      );

      // ✅ Proctoring settings
      if (proctoring) {
        await this.ProctoringSetting.create({ assessmentId: assessment.id, ...proctoring }, { transaction: t });
      }
      if (section_time_limit) {
        
        if (Array.isArray(sections) && sections.length > 0) {
          // ✅ Sum all section time limits
          const totalSectionTime = sections.reduce((sum, s) => {
            const time = s.timeLimit ?? 0;
            return sum + (typeof time === "number" && time > 0 ? time : 0);
          }, 0);
          if (totalSectionTime !== duration) {
            await t.rollback();
            return res.status(400).json({
              success: false,
              message: `Sum of section time limits (${totalSectionTime} mins) must equal assessment duration (${duration} mins).`
            });
          }
        }
      }
        // sum all section marks
        const totalSectionMarks = sections.reduce((sum, s) => {
          const marks = s.marks ?? 0;
          return sum + (typeof marks === "number" && marks > 0 ? marks : 0);
        }, 0);
        if (totalSectionMarks !== totalMarks) {
          await t.rollback();
          return res.status(400).json({
            success: false,
            message: `Sum of section marks (${totalSectionMarks}) must equal total marks (${totalMarks}).`
          });
        }

        for (const s of sections) {
          // ✅ Validate name
          if (!s.name || typeof s.name !== "string" || !s.name.trim()) {
            await t.rollback();
            return res.status(400).json({ success: false, message: "Section name is required." });
          }

          // ✅ Validate sectionOrder
          if (!s.sectionOrder || typeof s.sectionOrder !== "number" || s.sectionOrder <= 0) {
            await t.rollback();
            return res.status(400).json({ success: false, message: "Valid sectionOrder is required and must be > 0." });
          }

          // ✅ Check duplicate sectionOrder
          const exists = await this.Section.findOne({
            where: { assessmentId: assessment.id, sectionOrder: s.sectionOrder },
            transaction: t
          });
          if (exists) {
            await t.rollback();
            return res.status(400).json({
              success: false,
              message: `Section with order ${s.sectionOrder} already exists for this assessment.`
            });
          }

          // ✅ Validate type
          if (s.type && !["coding", "noncoding"].includes(s.type)) {
            await t.rollback();
            return res.status(400).json({ success: false, message: "Invalid section type. Must be 'coding' or 'noncoding'." });
          }

          // ✅ Validate marks
          if (s.marks !== undefined && (typeof s.marks !== "number" || s.marks < 0)) {
            await t.rollback();
            return res.status(400).json({ success: false, message: "Marks must be a non-negative number." });
          }

          // ✅ Validate timeLimit
          if (section_time_limit && (s.timeLimit === undefined || s.timeLimit === null || s.timeLimit <= 0)) {
            await t.rollback();
            return res.status(400).json({ success: false, message: "Each section must have a valid positive timeLimit." });
          }
          // ✅ Validate question_count
          if (s.question_count === undefined || s.question_count === null || s.question_count <= 0) {
            await t.rollback();
            return res.status(400).json({ success: false, message: "Each section must have a valid positive question_count." });
          }


          // ✅ Create section
          const section = await this.Section.create(
            {
              assessmentId: assessment.id,
              name: s.name.trim(),
              description: s.description ?? null,
              type: s.type ?? "noncoding",
              sectionOrder: s.sectionOrder,
              marks: s.marks ?? 0,
              timeLimit: (section_time_limit) ? (s.timeLimit ?? null) : null,
              instructions: s.instructions ?? null,
              question_count: s.question_count ?? 1
            },
            { transaction: t }
          );
          console.log("section", section);
        }


      await t.commit();

      // ✅ Invalidate cache
      await redis.del('assessments:list:*');

      return res.status(201).json({ success: true, data: assessment });
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
        'title', 'description', 'instructions', 'totalMarks', 'totalDuration', 'passingMarks', 'status', 'startTime', 'endTime'
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
      const now = new Date(new Date()+ 5.5 * 60 * 60 * 1000);

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
