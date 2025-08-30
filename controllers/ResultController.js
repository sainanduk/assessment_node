const { Op } = require("sequelize");
const Utils = require("./utils");
const redis = require("../config/redis");

class ReportController {
  constructor({ 
    sequelize, 
    Report, 
    Submission, 
    Assessment, 
    Section, 
    Question, 
    Option, 
    Attempt, 
    AssessmentAssignment 
  }) {
    this.sequelize = sequelize;
    this.Report = Report;
    this.Submission = Submission;
    this.Assessment = Assessment;
    this.Section = Section;
    this.Question = Question;
    this.Option = Option;
    this.Attempt = Attempt;
    this.AssessmentAssignment = AssessmentAssignment;

    this.calculateAndStoreResult = this.calculateAndStoreResult.bind(this);
    this.getAssessmentData = this.getAssessmentData.bind(this);
    this.getReport = this.getReport.bind(this);
    this.getReportsByUser = this.getReportsByUser.bind(this);
    this.getReportsByAssessment = this.getReportsByAssessment.bind(this);
  }

  // ---------- GET ASSESSMENT SCORING DATA WITH CACHING ----------
  async getAssessmentData(assessmentId) {
    const cacheKey = `assessment:${assessmentId}:scoring`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch assessment with scoring-relevant data
      const assessment = await this.Assessment.findByPk(assessmentId, {
        attributes: ['id'],
        include: [
          {
            model: this.Section,
            as: "sections",
            attributes: ['id'],
            include: [
              {
                model: this.Question,
                as: "questions",
                attributes: ['id', 'weight', 'type'], // weight = marks per question
                include: [
                  {
                    model: this.Option,
                    as: "options",
                    attributes: ['id', 'isCorrect']
                  }
                ]
              }
            ]
          }
        ]
      });

      if (!assessment) {
        return null;
      }

      // Transform data for efficient scoring
      const scoreData = {
        id: assessment.id,
        sections: {}, // sectionId -> {questions: {questionId -> {weight, correctOptions: []}}}
        questionToSection: {} // for quick section lookup by questionId
      };

      assessment.sections.forEach(section => {
        const sectionId = section.id;
        scoreData.sections[sectionId] = { questions: {} };

        section.questions.forEach(question => {
          const questionId = question.id;
          const weight = question.weight || 1; // default weight 1
          
          // Collect correct option IDs
          const correctOptions = question.options
            .filter(opt => opt.isCorrect)
            .map(opt => opt.id);

          scoreData.sections[sectionId].questions[questionId] = {
            weight,
            correctOptions,
            totalOptions: question.options.length
          };

          // Quick lookup mapping
          scoreData.questionToSection[questionId] = sectionId;
        });
      });

      // Cache for 1 hour
      await redis.set(cacheKey, JSON.stringify(scoreData), "EX", 3600);
      return scoreData;
      
    } catch (error) {
      console.error("Error fetching assessment scoring data:", error);
      throw error;
    }
  }

  // ---------- CALCULATE QUESTION SCORE ----------
  calculateQuestionScore(selectedOptions, correctOptions, weight) {
    if (!selectedOptions || selectedOptions.length === 0) {
      return 0; // No selection = 0 marks
    }

    const correctSet = new Set(correctOptions);
    const selectedSet = new Set(selectedOptions);

    let correctSelectedCount = 0;
    let incorrectSelectedCount = 0;

    selectedSet.forEach(optId => {
      if (correctSet.has(optId)) {
        correctSelectedCount++;
      } else {
        incorrectSelectedCount++;
      }
    });

    // Scoring logic: No negative marking, partial credit for correct selections
    // Only award marks if no incorrect options are selected
    if (incorrectSelectedCount === 0 && correctSelectedCount > 0) {
      return (correctSelectedCount / correctSet.size) * weight;
    }

    return 0; // Incorrect selections or no correct selections
  }

  // ---------- CALCULATE AND STORE RESULT ----------
  async calculateAndStoreResult(req, res) {
    const t = await this.sequelize.transaction();
    
    try {
      const { attemptId } = req.body;

      // Basic validation
      if (!attemptId) {
        await t.rollback();
        return res.status(400).json({
          error: "ValidationError",
          details: "attemptId is required"
        });
      }

      if (isNaN(attemptId)) {
        await t.rollback();
        return res.status(400).json({
          error: "ValidationError",
          details: "attemptId must be a valid number"
        });
      }

      // Get attempt with assignment details
      const attempt = await this.Attempt.findByPk(attemptId, {
        attributes: ['id', 'userId', 'status', 'assignmentId'],
        include: [
          {
            model: this.AssessmentAssignment,
            as: "assignment",
            attributes: ["id", "assessmentId"]
          }
        ],
        transaction: t
      });

      if (!attempt) {
        await t.rollback();
        return res.status(404).json({
          error: "NotFound",
          details: "Attempt not found"
        });
      }

      // Check if attempt is submitted
      if (attempt.status !== 'submitted' && attempt.status !== 'auto_submitted') {
        await t.rollback();
        return res.status(400).json({
          error: "InvalidAttemptStatus",
          details: "Can only calculate results for submitted attempts"
        });
      }

      // Get cached assessment scoring data
      const assessmentScoreData = await this.getAssessmentData(attempt.assignment.assessmentId);
      
      if (!assessmentScoreData) {
        await t.rollback();
        return res.status(404).json({
          error: "NotFound",
          details: "Assessment not found"
        });
      }

      // Get all submissions for this attempt
      const submissions = await this.Submission.findAll({
        where: { attemptId },
        attributes: ['questionId', 'selectedOptions'],
        transaction: t
      });

      // Calculate scores
      const sectionScores = {};
      let totalScore = 0;
      let totalQuestions = 0;
      let answeredQuestions = 0;

      // Process each submission
      for (const submission of submissions) {
        const questionId = submission.questionId;
        const selectedOptions = submission.selectedOptions || [];

        // Find section using quick lookup
        const sectionId = assessmentScoreData.questionToSection[questionId];
        if (!sectionId) continue;

        const questionData = assessmentScoreData.sections[sectionId].questions[questionId];
        if (!questionData) continue;

        totalQuestions++;
        if (selectedOptions.length > 0) answeredQuestions++;

        // Calculate question score
        const questionScore = this.calculateQuestionScore(
          selectedOptions,
          questionData.correctOptions,
          questionData.weight
        );

        // Accumulate section score
        if (!sectionScores[sectionId]) {
          sectionScores[sectionId] = 0;
        }
        sectionScores[sectionId] += questionScore;
        totalScore += questionScore;
      }

      // Calculate percentage if total possible score exists
      let totalPossibleScore = 0;
      Object.values(assessmentScoreData.sections).forEach(section => {
        Object.values(section.questions).forEach(question => {
          totalPossibleScore += question.weight;
        });
      });

      const percentage = totalPossibleScore > 0 ? (totalScore / totalPossibleScore) * 100 : 0;

      // Check if report already exists
      let report = await this.Report.findOne({
        where: {
          userId: attempt.userId,
          assessmentAssignmentId: attempt.assignmentId,
          assessmentId: attempt.assignment.assessmentId
        },
        transaction: t
      });

      const reportData = {
        score: parseFloat(totalScore.toFixed(2)),
        sectionScores,
        updatedAt: new Date(new Date()+ 5.5 * 60 * 60 * 1000)
      };

      if (report) {
        // Update existing report
        Object.assign(report, reportData);
        await report.save({ transaction: t });
      } else {
        // Create new report
        report = await this.Report.create({
          userId: attempt.userId,
          assessmentAssignmentId: attempt.assignmentId,
          assessmentId: attempt.assignment.assessmentId,
          ...reportData,
          createdAt: new Date(new Date()+ 5.5 * 60 * 60 * 1000)
        }, { transaction: t });
      }

      await t.commit();

      // Invalidate related caches
      await redis.del(`report:${report.id}`);
      await redis.del(`reports:user:${attempt.userId}:*`);
      await redis.del(`reports:assessment:${attempt.assignment.assessmentId}:*`);

      return res.status(200).json({
        data: {
          ...report.toJSON(),
          statistics: {
            totalQuestions,
            answeredQuestions,
            totalPossibleScore: parseFloat(totalPossibleScore.toFixed(2)),
            percentage: parseFloat(percentage.toFixed(2))
          }
        },
        message: "Result calculated and stored successfully"
      });

    } catch (err) {
      await t.rollback();
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- GET SINGLE REPORT ----------
  async getReport(req, res) {
    try {
      const reportId = req.params.id;
      
      if (!reportId || isNaN(reportId)) {
        return res.status(400).json({
          error: "ValidationError",
          details: "Valid report ID is required"
        });
      }

      const cacheKey = `report:${reportId}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      const report = await this.Report.findByPk(reportId, {
        include: [
          {
            model: this.Assessment,
            as: "assessment",
            attributes: ["id", "title"]
          },
          {
            model: this.AssessmentAssignment,
            as: "assignment",
            attributes: ["id", "title", "dueDate"]
          }
        ]
      });

      if (!report) {
        return res.status(404).json({ error: "NotFound" });
      }

      const response = { data: report };
      
      // Cache for 10 minutes
      await redis.set(cacheKey, JSON.stringify(response), "EX", 600);
      
      return res.json(response);
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- GET REPORTS BY USER ----------
  async getReportsByUser(req, res) {
    try {
      const userId = req.params.userId;
      
      if (!userId) {
        return res.status(400).json({
          error: "ValidationError",
          details: "userId is required"
        });
      }

      const cacheKey = `reports:user:${userId}:${JSON.stringify(req.query)}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      const { limit, offset } = Utils.parsePagination(req.query);
      const where = { userId };

      if (req.query.assessmentId) {
        where.assessmentId = req.query.assessmentId;
      }

      const { rows, count } = await this.Report.findAndCountAll({
        where,
        limit,
        offset,
        order: [["createdAt", "DESC"]],
        include: [
          {
            model: this.Assessment,
            as: "assessment",
            attributes: ["id", "title"]
          },
          {
            model: this.AssessmentAssignment,
            as: "assignment",
            attributes: ["id", "title", "dueDate"]
          }
        ]
      });

      const response = { 
        data: rows, 
        page: Math.floor(offset / limit) + 1, 
        limit, 
        total: count 
      };

      // Cache for 5 minutes
      await redis.set(cacheKey, JSON.stringify(response), "EX", 300);
      
      return res.json(response);
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- GET REPORTS BY ASSESSMENT ----------
  async getReportsByAssessment(req, res) {
    try {
      const assessmentId = req.params.assessmentId;
      
      if (!assessmentId || isNaN(assessmentId)) {
        return res.status(400).json({
          error: "ValidationError",
          details: "Valid assessmentId is required"
        });
      }

      const cacheKey = `reports:assessment:${assessmentId}:${JSON.stringify(req.query)}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      const { limit, offset } = Utils.parsePagination(req.query);
      const where = { assessmentId };

      const { rows, count } = await this.Report.findAndCountAll({
        where,
        limit,
        offset,
        order: [["score", "DESC"], ["createdAt", "ASC"]], // Rank by score
        include: [
          {
            model: this.Assessment,
            as: "assessment",
            attributes: ["id", "title"]
          }
        ]
      });

      const response = { 
        data: rows, 
        page: Math.floor(offset / limit) + 1, 
        limit, 
        total: count 
      };

      // Cache for 5 minutes
      await redis.set(cacheKey, JSON.stringify(response), "EX", 300);
      
      return res.json(response);
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }
}

module.exports = ReportController;
