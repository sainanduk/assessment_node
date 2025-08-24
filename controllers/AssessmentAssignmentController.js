const { Op } = require("sequelize");
const Utils = require("./utils");
const redis = require("../config/redis");

class AssessmentAssignmentController {
  constructor({ sequelize, AssessmentAssignment, Assessment, Institute, Batch ,Attempt,ProctoringSetting}) {
    this.sequelize = sequelize;
    this.AssessmentAssignment = AssessmentAssignment;
    this.Assessment = Assessment;
    this.Institute = Institute;
    this.Batch = Batch;
    this.Attempt = Attempt; // Assuming you have an Attempt model for tracking attempts
    this.ProctoringSetting=ProctoringSetting;
    // bind methods
    this.list = this.list.bind(this);
    this.get = this.get.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.remove = this.remove.bind(this);
  }

  /** ========== LIST ALL ASSIGNMENTS ========== */
async list(req, res) {
  try {
    const cacheKey = `assessment-assignments:list:${JSON.stringify(req.query)}`;
    const cached = await redis.get(cacheKey);

    if (cached) return res.json(JSON.parse(cached));

    const { limit, offset } = Utils.parsePagination(req.query);
    const where = {};
    
    if (req.query.instituteId) where.instituteId = req.query.instituteId;
    if (req.query.batchId) where.batchId = req.query.batchId;
    console.log("Query Params:", req.query);
    
    const { rows, count } = await this.AssessmentAssignment.findAndCountAll({
      where,
      include: [
        {
          model: this.Assessment,
          as: 'Assessment',
          where: { 
            status: {
              [Op.in]: ['active', 'inactive', 'draft']
            }
          },
          include: [
            {
              model: this.ProctoringSetting,
              as: 'proctoring_settings',
              required: false
            }
          ]
        },
        {
          model: this.Attempt,
          as: 'Attempts',
          where: {
            userId: req.query.userId 
          },
          required: false
        }
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]]
    });
    
    console.log("Fetched assignments:", rows);

    // Process each assignment to match frontend Assessment interface
    // console.log("Processing assignments for response...");
    // console.log("Rows:", JSON.stringify(rows, null, 2));
    
    
    const processedData = rows.map(assignment => {
      const assignmentData = assignment.toJSON();
      const assessment = assignmentData.Assessment;
      
      // Calculate attempt status
      let attemptStatus = 'start';
      
      if (assignmentData.Attempts && assignmentData.Attempts.length > 0) {
        const latestAttempt = assignmentData.Attempts[assignmentData.Attempts.length - 1];
        
        if (latestAttempt.status === 'completed') {
          attemptStatus = 'completed';
        } else if (latestAttempt.status === 'in_progress' || latestAttempt.startedAt) {
          attemptStatus = 'resume';
        }
      }
      
      // Map database fields to frontend interface fields
      const response = {
        id: assessment.id,
        assignmentId: assignmentData.id,
        title: assessment.title,
        description: assessment.description,
        duration: assessment.duration, // Updated field name
        total_questions: assessment.total_questions || 0, // Updated field name
        passing_score: assessment.passing_score, // Updated field name
        instructions: assessment.instructions,
        is_proctored: assessment.is_proctored || false, // Updated field name
        status: assessment.status,
        difficulty: assessment.difficulty || "medium", // Updated field name
        time_limit: assessment.time_limit || true, // Updated field name
        show_results: assessment.show_results || false, // Updated field name
        shuffle_questions: assessment.shuffle_questions || false, // Updated field name
        shuffle_options: assessment.shuffle_options || false, // Updated field name
        
        // Additional fields from your current response
        assessmentId: assessment.id,
        totalMarks: assessment.totalMarks,
        attemptsAllowed: assessment.attemptsAllowed,
        type: assessment.type,
        startTime: assessment.startTime,
        endTime: assessment.endTime,
        attempt_Status: attemptStatus
      };

      // Add proctoring_settings matching the updated ProctoringSettings interface
      if (assessment.proctoring_settings) {
        const proctoring = assessment.proctoring_settings;
        response.proctoring_settings = {
          voice_monitoring: proctoring.voice_monitoring || false,
          face_proctoring: proctoring.face_proctoring || true,
          electronic_monitoring: proctoring.electronic_monitoring || false,
          is_fullscreen: proctoring.is_fullscreen || true,
          auto_terminate: proctoring.auto_terminate || true,
          termination_threshold: proctoring.termination_threshold || 5,
          warning_threshold: proctoring.warning_threshold || 3,
          max_tab_switches: proctoring.max_tab_switches || 3,
          max_face_not_detected_time: proctoring.max_face_not_detected_time || 30,
          max_voice_detected_time: proctoring.max_voice_detected_time || 30,
          max_multiple_faces_time: proctoring.max_multiple_faces_time || 10,
          notification_email: proctoring.notification_email || ""
        };
      }
      

      return response;
    });

    const response = {
      data: processedData,
      page: Math.floor(offset / limit) + 1,
      limit,
      total: count,
    };

    await redis.set(cacheKey, JSON.stringify(response), "EX", 60);
    return res.json(response);
  } catch (err) {
    console.error("Error listing assignments:", err);
    return Utils.handleSequelizeError(err, res);
  }
}








  /** ========== GET ONE ASSIGNMENT ========== */
  async get(req, res) {
    try {
      const { id } = req.params;
      const assignment = await this.AssessmentAssignment.findByPk(id, {
        include: [
          { model: this.Assessment, as: "assessment" },
          { model: this.Institute, as: "institute" },
          { model: this.Batch, as: "batch" }
        ]
      });

      if (!assignment) {
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }

      return res.json({ success: true, data: assignment });
    } catch (err) {
      console.error("Error fetching assignment:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /** ========== CREATE ASSIGNMENT ========== */
  async create(req, res) {
    const t = await this.sequelize.transaction();
    try {
      const { assessmentId, instituteId, batchId } = req.body;

      if (!assessmentId || !instituteId || !batchId) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }

      const assignment = await this.AssessmentAssignment.create(
        { assessmentId, instituteId, batchId },
        { transaction: t }
      );

      await t.commit();
      return res.status(201).json({ success: true, data: assignment });
    } catch (err) {
      await t.rollback();
      console.error("Error creating assignment:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /** ========== UPDATE ASSIGNMENT ========== */
  async update(req, res) {
    const t = await this.sequelize.transaction();
    try {
      const { id } = req.params;
      const { assessmentId, instituteId, batchId } = req.body;

      const assignment = await this.AssessmentAssignment.findByPk(id);
      if (!assignment) {
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }

      await assignment.update(
        { assessmentId, instituteId, batchId },
        { transaction: t }
      );

      await t.commit();
      return res.json({ success: true, data: assignment });
    } catch (err) {
      await t.rollback();
      console.error("Error updating assignment:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /** ========== DELETE ASSIGNMENT ========== */
  async remove(req, res) {
    const t = await this.sequelize.transaction();
    try {
      const { id } = req.params;

      const assignment = await this.AssessmentAssignment.findByPk(id);
      if (!assignment) {
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }

      await assignment.destroy({ transaction: t });
      await t.commit();

      return res.json({ success: true, message: "Assignment deleted successfully" });
    } catch (err) {
      await t.rollback();
      console.error("Error deleting assignment:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = AssessmentAssignmentController;
