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
              as: 'ProctoringSetting',
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
        title: assessment.title,
        description: assessment.description,
        duration: assessment.totalDuration, // totalDuration -> duration
        total_questions: assessment.totalQuestions || 0, // add if available in your db
        passing_score: assessment.passingMarks, // passingMarks -> passing_score
        instructions: assessment.instructions,
        is_proctored: assessment.ProctoringSetting?.enableProctoring || false,
        created_at: assessment.createdAt,
        updated_at: assessment.updatedAt,
        status: assessment.status,
        tags: assessment.tags || [], // add if available in your db
        difficulty: assessment.difficulty || "medium", // add if available in your db  
        category: assessment.category || "", // add if available in your db
        time_limit: Boolean(assessment.totalDuration), // based on whether duration exists
        allow_review: assessment.allowReview || false, // add if available in your db
        show_results: assessment.showResults || false, // add if available in your db
        shuffle_questions: assessment.shuffleQuestions || false, // add if available in your db
        shuffle_options: assessment.shuffleOptions || false, // add if available in your db
        
        // Additional fields from your current response
        assessmentId: assessment.id,
        totalMarks: assessment.totalMarks,
        attemptsAllowed: assessment.attemptsAllowed,
        type: assessment.type,
        startTime: assessment.startTime,
        endTime: assessment.endTime,
        userId: assessment.userId,
        attempt_Status: attemptStatus
      };

      // Add proctoring_settings matching the ProctoringSettings interface
      if (assessment.ProctoringSetting) {
        const proctoring = assessment.ProctoringSetting;
        response.proctoring_settings = {
          voice_monitoring: proctoring.settingsJson?.voice_monitoring || false,
          face_proctoring: proctoring.faceDetection || false,
          electronic_monitoring: proctoring.screenRecording || false,
          is_fullscreen: proctoring.fullScreenRequired || false,
          auto_terminate: proctoring.autoSubmitOnViolation || false,
          termination_threshold: proctoring.settingsJson?.termination_threshold || 5,
          warning_threshold: proctoring.settingsJson?.warning_threshold || 3,
          max_tab_switches: proctoring.maxTabSwitches || 0,
          max_face_not_detected_time: proctoring.settingsJson?.max_face_not_detected_time || 30,
          max_voice_detected_time: proctoring.settingsJson?.max_voice_detected_time || 30,
          max_multiple_faces_time: proctoring.settingsJson?.max_multiple_faces_time || 10,
          notification_email: proctoring.settingsJson?.notification_email || ""
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
