// controllers/AttemptController.js
const { Op } = require('sequelize');
const Utils = require('./utils');
const redis = require('../config/redis'); // your redis connection

/**
 * Assumptions:
 * - AssessmentAssignment model exists and links to Assessment via assessmentId
 * - Assessment model has a field attemptsAllowed (number of attempts permitted per user for that assessment)
 * - Associations (ensure these in your model setup):
 *    Attempt.belongsTo(AssessmentAssignment, { as: 'assignment', foreignKey: 'assignmentId' });
 *    AssessmentAssignment.belongsTo(Assessment, { as: 'assessment', foreignKey: 'assessmentId' });
 */
class AttemptController {
  constructor({ sequelize, Attempt, AssessmentAssignment, Assessment, User }) {
    this.sequelize = sequelize;
    this.Attempt = Attempt;
    this.AssessmentAssignment = AssessmentAssignment;
    this.Assessment = Assessment;
    this.User = User;

    this.list = this.list.bind(this);
    this.get = this.get.bind(this);
    this.create = this.create.bind(this);
    this.submit = this.submit.bind(this);
    this.updateMeta = this.updateMeta.bind(this); // update ip/userAgent/time
    this.remove = this.remove.bind(this);
  }

  // ---------- LIST ----------
  // Optional filters: userId, assignmentId, status, from, to; with pagination
  async list(req, res) {
    try {
      const { limit, offset } = Utils.parsePagination(req.query);
      const where = {};

      if (req.query.userId) where.userId = req.query.userId;
      if (req.query.assignmentId) where.assignmentId = req.query.assignmentId;
      if (req.query.status) where.status = req.query.status;
      if (req.query.from || req.query.to) {
        where.startedAt = {};
        if (req.query.from) where.startedAt[Op.gte] = new Date(req.query.from);
        if (req.query.to) where.startedAt[Op.lte] = new Date(req.query.to);
      }

      const cacheKey = `attempts:list:${JSON.stringify(where)}:${limit}:${offset}`;
      const cached = await redis.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));

      const { rows, count } = await this.Attempt.findAndCountAll({
        where,
        limit,
        offset,
        order: [['startedAt', 'DESC']]
      });

      const response = {
        data: rows,
        page: Math.floor(offset / limit) + 1,
        limit,
        total: count
      };

      await redis.set(cacheKey, JSON.stringify(response), 'EX', 60);
      return res.json(response);
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- GET ----------
  async get(req, res) {
    try {
      const { id } = req.params;
      const cacheKey = `attempt:${id}`;
      const cached = await redis.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));

      const attempt = await this.Attempt.findByPk(id);
      if (!attempt) return res.status(404).json({ error: 'NotFound' });

      const response = { data: attempt };
      await redis.set(cacheKey, JSON.stringify(response), 'EX', 120);
      return res.json(response);
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- CREATE (START NEW ATTEMPT) ----------
  /**
   * Body: { assignmentId, userId, ipAddress?, userAgent? }
   * Logic:
   *  - Find the assignment and its linked assessment to read attemptsAllowed
   *  - Count user's existing attempts for this assignment
   *  - If count >= attemptsAllowed => 403
   *  - Else create new attempt with attemptNumber = count + 1
   */
async create(req, res) {
  const t = await this.sequelize.transaction();
  try {
    const { ipAddress, userAgent } = req.body;
    const { userId, instituteId, batchId } = req.body; // from middleware
    const assignmentId = 2;
    console.log("Create attempt called with", { assignmentId, userId, instituteId, batchId });
    
    if (!assignmentId || !userId) {
      await t.rollback();
      return res.status(400).json({ error: 'BadRequest', message: 'assignmentId and userId are required' });
    }

    // 🔹 Step 1: Check cache for assignment-batch relation
    const cacheKeyAssignment = `assignment:${assignmentId}:batch:${batchId}:institute:${instituteId}`;
    const cacheKeyAssessment = `assessment:${assignmentId}`;

    let assessmentData = await redis.get(cacheKeyAssessment);
    let isAssigned = await redis.get(cacheKeyAssignment);

    if (!isAssigned || !assessmentData) {
      console.log("Cache miss for assignment or assessment, querying DB");
      
const assignment = await this.AssessmentAssignment.findOne({
  where: { id: assignmentId, instituteId, batchId },
  include: [
    { 
      model: this.Assessment, 
      as: 'Assessment', // Changed from 'assessment' to 'Assessment'
      attributes: ['id', 'title', 'attemptsAllowed', 'startTime', 'endTime', 'status'] 
    }
  ],
  transaction: t
});


      if (!assignment) {
        await t.rollback();
        return res.status(403).json({ error: 'Forbidden', message: 'Assessment not assigned to this batch' });
      }

      assessmentData = assignment.Assessment ? assignment.Assessment.toJSON() : null; // Capital A

      if (!assessmentData) {
        await t.rollback();
        return res.status(404).json({ error: 'NotFound', message: 'Assessment not linked to assignment' });
      }

      // cache assignment mapping and assessment details
      await redis.set(cacheKeyAssignment, "true", "EX", 60); 
      await redis.set(cacheKeyAssessment, JSON.stringify(assessmentData), "EX", 60 ); 

      isAssigned = true;
    } else {
      assessmentData = JSON.parse(assessmentData);
    }

    // 🔹 Step 2: Check if user already has an in-progress attempt
    const attempts = await this.Attempt.findAll({
      where: { assignmentId, userId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    const inProgress = attempts.find(a => a.status === 'in_progress');
    if (inProgress) {
      await t.commit();
      return res.status(200).json({ data: inProgress, message: "Resuming existing in-progress attempt" });
    }

    const attemptsCount = attempts.length;
    const allowed = Number(assessmentData.attemptsAllowed ?? 1);

    // 🔹 Step 3: Gate by time/status
    const now = new Date();
    if (assessmentData.startTime && now < new Date(assessmentData.startTime)) {
      await t.rollback();
      return res.status(403).json({ error: 'Forbidden', message: 'Assessment not started yet' });
    }
    if (assessmentData.endTime && now > new Date(assessmentData.endTime)) {
      await t.rollback();
      return res.status(403).json({ error: 'Forbidden', message: 'Assessment already ended' });
    }
    if (assessmentData.status && assessmentData.status === 'inactive') {
      await t.rollback();
      return res.status(403).json({ error: 'Forbidden', message: 'Assessment not available' });
    }

    // 🔹 Step 4: Check attempt limits
    if (Number.isNaN(allowed) || allowed < 1) {
      await t.rollback();
      return res.status(403).json({ error: 'Forbidden', message: 'No attempts allowed for this assessment' });
    }
    if (attemptsCount >= allowed) {
      await t.rollback();
      return res.status(403).json({ error: 'Forbidden', message: 'Attempt limit reached' });
    }

    // 🔹 Step 5: Create new attempt
    const attempt = await this.Attempt.create({
      assignmentId,
      userId,
      attemptNumber: attemptsCount + 1,
      status: 'in_progress',
      ipAddress: ipAddress || (req.ip ?? null),
      userAgent: userAgent || (req.get?.('user-agent') ?? null)
    }, { transaction: t });

    await t.commit();

    // Clear cache of attempts list for this user-assignment
    await redis.del(`attempts:list:${assignmentId}:${userId}`);

    return res.status(201).json({ data: attempt });
  } catch (err) {
    await t.rollback();
    return Utils.handleSequelizeError(err, res);
  }
}


  // ---------- SUBMIT ATTEMPT ----------
  /**
   * Params: id
   * Body: { totalTimeSpent? }
   * Marks attempt as submitted (or auto_submitted if you pass a flag), sets submittedAt.
   */
  async submit(req, res) {
    const t = await this.sequelize.transaction();
    try {
      const { id } = req.params;
      const { auto = false, totalTimeSpent } = req.body || {};
      const attempt = await this.Attempt.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!attempt) {
        await t.rollback();
        return res.status(404).json({ error: 'NotFound' });
      }
      if (attempt.status === 'submitted' || attempt.status === 'auto_submitted') {
        await t.rollback();
        return res.status(409).json({ error: 'Conflict', message: 'Attempt already submitted' });
      }

      attempt.status = auto ? 'auto_submitted' : 'submitted';
      attempt.submittedAt = new Date();
      if (typeof totalTimeSpent === 'number') attempt.totalTimeSpent = totalTimeSpent;

      await attempt.save({ transaction: t });
      await t.commit();

      await redis.del(`attempt:${id}`);
      await redis.del('attempts:list:*');
      return res.json({ data: attempt });
    } catch (err) {
      await t.rollback();
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- UPDATE META (ip/userAgent/totalTimeSpent or mark abandoned) ----------
  /**
   * Params: id
   * Body: { ipAddress?, userAgent?, totalTimeSpent?, status? } // status only allows 'in_progress' or 'abandoned'
   */
  async updateMeta(req, res) {
    const t = await this.sequelize.transaction();
    try {
      const { id } = req.params;
      const attempt = await this.Attempt.findByPk(id, { transaction: t });
      if (!attempt) {
        await t.rollback();
        return res.status(404).json({ error: 'NotFound' });
      }

      const allowedStatus = new Set(['in_progress', 'abandoned']);
      const payload = {};
      if (req.body.ipAddress !== undefined) payload.ipAddress = req.body.ipAddress;
      if (req.body.userAgent !== undefined) payload.userAgent = req.body.userAgent;
      if (req.body.totalTimeSpent !== undefined) payload.totalTimeSpent = req.body.totalTimeSpent;
      if (req.body.status !== undefined) {
        if (!allowedStatus.has(req.body.status)) {
          await t.rollback();
          return res.status(400).json({ error: 'BadRequest', message: 'Invalid status update' });
        }
        payload.status = req.body.status;
      }

      await attempt.update(payload, { transaction: t });
      await t.commit();

      await redis.del(`attempt:${id}`);
      await redis.del('attempts:list:*');
      return res.json({ data: attempt });
    } catch (err) {
      await t.rollback();
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- REMOVE ----------
  async remove(req, res) {
    try {
      const { id } = req.params;
      const deleted = await this.Attempt.destroy({ where: { id } });
      if (!deleted) return res.status(404).json({ error: 'NotFound' });

      await redis.del(`attempt:${id}`);
      await redis.del('attempts:list:*');
      return res.status(204).send();
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }
}

module.exports = AttemptController;
