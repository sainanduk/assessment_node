const { Op } = require("sequelize");
const Utils = require("./utils");
const redis = require("../config/redis");

class SubmissionController {
  constructor({ 
    sequelize, 
    Submission, 
    Attempt, 
    Assessment, 
    Section, 
    Question, 
    Option,
    Report
  }) {
    this.sequelize = sequelize;
    this.Submission = Submission;
    this.Attempt = Attempt;
    this.Assessment = Assessment;
    this.Section = Section;
    this.Question = Question;
    this.Option = Option;
    this.Report = Report;

    this.create = this.create.bind(this);
    this.getAssessmentData = this.getAssessmentData.bind(this);
    this.validateSubmission = this.validateSubmission.bind(this);
    this.getByAttempt = this.getByAttempt.bind(this);
    this.finalSubmit = this.finalSubmit.bind(this);
  }

  // ---------- GET ASSESSMENT DATA WITH CACHING (OPTIMIZED) ----------
  async getAssessmentData(assessmentId) {
    const cacheKey = `assessment:${assessmentId}:ids_only`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        // Convert Arrays back to Sets for runtime efficiency
        return {
          id: data.id,
          validQuestions: new Set(data.validQuestions),
          validOptions: new Set(data.validOptions),
          questionToOptions: data.questionToOptions,
          optionToQuestion: data.optionToQuestion
        };
      }

      const assessment = await this.Assessment.findByPk(assessmentId, {
        attributes: ['id'], // Only fetch assessment ID
        include: [
          {
            model: this.Section,
            as: "sections",
            attributes: ['id'], // Only fetch section ID
            include: [
              {
                model: this.Question,
                as: "questions",
                attributes: ['id'], // Only fetch question ID
                through: { attributes: [] }, // Don't include junction table attributes
                include: [
                  {
                    model: this.Option,
                    as: "options",
                    attributes: ['id'] // Only fetch option ID
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

      // Transform data for O(1) lookup efficiency
      const assessmentData = {
        id: assessment.id,
        validQuestions: new Set(), // For O(1) question validation
        validOptions: new Set(),   // For O(1) option validation
        questionToOptions: {},     // Map question ID to its valid option IDs
        optionToQuestion: {}       // Map option ID to its question ID
      };

      assessment.sections.forEach(section => {
        section.questions.forEach(question => {
          const questionId = question.id;
          
          // Add question to valid set
          assessmentData.validQuestions.add(questionId);
          
          // Initialize options array for this question
          assessmentData.questionToOptions[questionId] = [];
          
          question.options.forEach(option => {
            const optionId = option.id;
            
            // Add option to valid set
            assessmentData.validOptions.add(optionId);
            
            // Map option to question
            assessmentData.optionToQuestion[optionId] = questionId;
            
            // Add option to question's options array
            assessmentData.questionToOptions[questionId].push(optionId);
          });
        });
      });

      // Convert Sets to Arrays for JSON serialization
      const serializedData = {
        id: assessmentData.id,
        validQuestions: Array.from(assessmentData.validQuestions),
        validOptions: Array.from(assessmentData.validOptions),
        questionToOptions: assessmentData.questionToOptions,
        optionToQuestion: assessmentData.optionToQuestion
      };

      // Cache for 1 hour
      await redis.set(cacheKey, JSON.stringify(serializedData), "EX", 3600);
      
      return assessmentData;
      
    } catch (error) {
      console.error("Error fetching assessment data:", error);
      throw error;
    }
  }

  // ---------- VALIDATE SUBMISSION (OPTIMIZED) ----------
  async validateSubmission(assessmentData, questionId, selectedOptions) {
    // Check if question exists in assessment - O(1) lookup
    if (!assessmentData.validQuestions.has(questionId)) {
      return {
        valid: false,
        error: "Question not found in assessment"
      };
    }

    // Validate selected options
    if (selectedOptions && selectedOptions.length > 0) {
      for (const optionId of selectedOptions) {
        // Check if option exists - O(1) lookup
        if (!assessmentData.validOptions.has(optionId)) {
          return {
            valid: false,
            error: `Option ${optionId} not found`
          };
        }
        
        // Check if option belongs to the question - O(1) lookup
        if (assessmentData.optionToQuestion[optionId] !== questionId) {
          return {
            valid: false,
            error: `Option ${optionId} does not belong to question ${questionId}`
          };
        }
      }
    }

    return { valid: true };
  }

  // ---------- CREATE SUBMISSION ----------
  async create(req, res) {
    const t = await this.sequelize.transaction();
    
    try {
      const { attemptId, questionId, selectedOptions } = req.body;

      // Basic validation
      if (!attemptId || !questionId) {
        await t.rollback();
        return res.status(400).json({
          error: "ValidationError",
          details: "attemptId and questionId are required"
        });
      }

      // Validate data types
      if (isNaN(attemptId) || isNaN(questionId)) {
        await t.rollback();
        return res.status(400).json({
          error: "ValidationError",
          details: "attemptId and questionId must be valid numbers"
        });
      }

      // Validate selectedOptions format
      if (selectedOptions && (!Array.isArray(selectedOptions) || selectedOptions.some(id => isNaN(id)))) {
        await t.rollback();
        return res.status(400).json({
          error: "ValidationError",
          details: "selectedOptions must be an array of valid option IDs"
        });
      }

      // Cache attempt data for 1 hour
      const attemptCacheKey = `attempt:${attemptId}`;
      let attempt = null;
      
      const cachedAttempt = await redis.get(attemptCacheKey);
      if (cachedAttempt) {
        attempt = JSON.parse(cachedAttempt);
      } else {
        attempt = await this.Attempt.findByPk(attemptId, {
          attributes: ['id', 'assessmentId', 'userId', 'status'],
          transaction: t
        });

        if (!attempt) {
          await t.rollback();
          return res.status(404).json({
            error: "NotFound",
            details: "Attempt not found"
          });
        }

        // Cache attempt for 1 hour
        await redis.set(attemptCacheKey, JSON.stringify(attempt), "EX", 3600);
      }

      // Check if attempt is still in progress
      if (attempt.status !== 'in_progress') {
        await t.rollback();
        return res.status(400).json({
          error: "InvalidAttemptStatus",
          details: "Cannot submit to a completed attempt"
        });
      }

      // Get assessment data with caching
      const assessmentData = await this.getAssessmentData(attempt.assessmentId);
      
      if (!assessmentData) {
        await t.rollback();
        return res.status(404).json({
          error: "NotFound",
          details: "Assessment not found"
        });
      }

      // Validate submission
      const validation = await this.validateSubmission(assessmentData, questionId, selectedOptions);
      if (!validation.valid) {
        await t.rollback();
        return res.status(400).json({
          error: "ValidationError",
          details: validation.error
        });
      }

      // Check if submission already exists for this attempt and question
      const existingSubmission = await this.Submission.findOne({
        where: {
          attemptId,
          questionId
        },
        transaction: t
      });

      let submission;
      
      if (existingSubmission) {
        // Update existing submission
        existingSubmission.selectedOptions = selectedOptions;
        existingSubmission.submittedAt = new Date();
        await existingSubmission.save({ transaction: t });
        submission = existingSubmission;
      } else {
        // Create new submission
        submission = await this.Submission.create({
          attemptId,
          questionId,
          selectedOptions,
          submittedAt: new Date()
        }, { transaction: t });
      }

      await t.commit();

      // Invalidate related caches
      await redis.del(`submissions:attempt:${attemptId}`);
      await redis.del(`attempt:${attemptId}:progress`);

      return res.status(201).json({
        data: submission,
        message: existingSubmission ? "Submission updated successfully" : "Submission created successfully"
      });

    } catch (err) {
      await t.rollback();
      return Utils.handleSequelizeError(err, res);
    }
  }


  // ---------- GET SUBMISSIONS BY ATTEMPT ----------
  async getByAttempt(req, res) {
    try {
      const attemptId = req.params.attemptId;
      
      if (!attemptId || isNaN(attemptId)) {
        return res.status(400).json({
          error: "ValidationError",
          details: "Valid attemptId is required"
        });
      }

      const cacheKey = `submissions:attempt:${attemptId}`;
      
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      const submissions = await this.Submission.findAll({
        where: { attemptId },
        order: [["submittedAt", "ASC"]],
        include: [
          {
            model: this.Question,
            as: "question",
            attributes: ["id", "text", "type"]
          }
        ]
      });

      const response = { data: submissions };
      
      // Cache for 5 minutes
      await redis.set(cacheKey, JSON.stringify(response), "EX", 300);
      
      return res.json(response);
    } catch (err) {
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- FINAL SUBMIT ----------
  async finalSubmit(req, res) {
    const t = await this.sequelize.transaction();
    
    try {
      const { attemptId } = req.body;

      // Basic validation
      if (!attemptId || isNaN(attemptId)) {
        await t.rollback();
        return res.status(400).json({
          error: "ValidationError",
          details: "Valid attemptId is required"
        });
      }

      // Get attempt details
      const attempt = await this.Attempt.findByPk(attemptId, {
        transaction: t
      });

      if (!attempt) {
        await t.rollback();
        return res.status(404).json({
          error: "NotFound",
          details: "Attempt not found"
        });
      }

      // Check if attempt is still in progress
      if (attempt.status !== 'in_progress') {
        await t.rollback();
        return res.status(400).json({
          error: "InvalidAttemptStatus",
          details: "Attempt is already completed or not in progress"
        });
      }

      // Get all submissions for this attempt
      const submissions = await this.Submission.findAll({
        where: { attemptId },
        transaction: t
      });

      // Cache assessment data for frequent access (1 hour)
      const assessmentCacheKey = `assessment:${attempt.assessmentId}:scoring_data`;
      let assessment = null;
      
      const cachedAssessment = await redis.get(assessmentCacheKey);
      if (cachedAssessment) {
        assessment = JSON.parse(cachedAssessment);
      } else {
        // Get assessment with questions, options, and sections for scoring
        assessment = await this.Assessment.findByPk(attempt.assessmentId, {
          include: [
            {
              model: this.Section,
              as: 'sections',
              include: [
                {
                  model: this.Question,
                  as: 'questions',
                  through: { attributes: [] }, // Don't include junction table attributes
                  include: [
                    {
                      model: this.Option,
                      as: 'options',
                      attributes: ['id', 'isCorrect']
                    }
                  ]
                }
              ]
            }
          ],
          transaction: t
        });

        if (!assessment) {
          await t.rollback();
          return res.status(404).json({
            error: "NotFound",
            details: "Assessment not found"
          });
        }

        // Cache assessment data for 1 hour
        await redis.set(assessmentCacheKey, JSON.stringify(assessment), "EX", 3600);
      }

      // Calculate scores
      let totalScore = 0;
      const sectionScores = {};
      const questionResults = [];

      // Handle case where there are no submissions
      if (submissions.length === 0) {
        // Create report with zero score for empty submission
        const existingReport = await this.Report.findOne({
          where: {
            userId: attempt.userId,
            assessmentId: attempt.assessmentId
          },
          transaction: t
        });

        let report;
        if (existingReport) {
          // Update existing report with zero score
          existingReport.score = 0;
          existingReport.sectionScores = {};
          await existingReport.save({ transaction: t });
          report = existingReport;
        } else {
          // Create new report with zero score
          report = await this.Report.create({
            userId: attempt.userId,
            assessmentId: attempt.assessmentId,
            score: 0,
            sectionScores: {}
          }, { transaction: t });
        }

        // Mark attempt as completed
        attempt.status = 'completed';
        attempt.completedAt = new Date();
        await attempt.save({ transaction: t });

        await t.commit();

        // Invalidate related caches
        await redis.del(`attempt:${attemptId}`);
        await redis.del(`submissions:attempt:${attemptId}`);
        await redis.del(`reports:user:${attempt.userId}:assessment:${attempt.assessmentId}`);

        return res.status(200).json({
          data: {
            attemptId: attempt.id,
            status: attempt.status,
            completedAt: attempt.completedAt,
            totalScore: 0,
            sectionScores: {},
            reportId: report.id,
            questionResults: [],
            message: "Assessment submitted with no answers"
          },
          message: "Assessment submitted successfully (no submissions)"
        });
      }

      // Process each submission
      for (const submission of submissions) {
        const question = assessment.sections
          .flatMap(section => section.questions)
          .find(q => q.id === submission.questionId);

        if (!question) {
          console.warn(`Question ${submission.questionId} not found in assessment`);
          continue;
        }

        const section = assessment.sections.find(s => 
          s.questions.some(q => q.id === question.id)
        );

        if (!section) {
          console.warn(`Section not found for question ${submission.questionId}`);
          continue;
        }

        // Get correct options for this question
        const correctOptions = question.options.filter(option => option.isCorrect);
        const selectedOptions = submission.selectedOptions || [];

        // Calculate question score
        let questionScore = 0;
        let isCorrect = false;

        if (question.type === 'single_correct') {
          // For single correct questions
          if (selectedOptions.length === 1 && correctOptions.length === 1) {
            const selectedOption = correctOptions.find(opt => opt.id === selectedOptions[0]);
            if (selectedOption) {
              questionScore = question.marks;
              isCorrect = true;
            }
          }
        } else if (question.type === 'multi_correct') {
          // For multiple correct questions
          const correctOptionIds = correctOptions.map(opt => opt.id);
          const selectedCorrectCount = selectedOptions.filter(id => correctOptionIds.includes(id)).length;
          const selectedIncorrectCount = selectedOptions.filter(id => !correctOptionIds.includes(id)).length;
          const totalCorrectCount = correctOptions.length;

          if (selectedCorrectCount === totalCorrectCount && selectedIncorrectCount === 0) {
            // All correct options selected and no incorrect options
            questionScore = question.marks;
            isCorrect = true;
          } else if (selectedCorrectCount > 0) {
            // Partial credit: (correct selected - incorrect selected) / total correct
            const partialScore = Math.max(0, (selectedCorrectCount - selectedIncorrectCount) / totalCorrectCount);
            questionScore = question.marks * partialScore;
          }
        }

        // Apply negative marking if applicable
        if (!isCorrect && question.negativeMarks > 0) {
          questionScore = -question.negativeMarks;
        }

        // Add to total score
        totalScore += questionScore;

        // Add to section score
        if (!sectionScores[section.id]) {
          sectionScores[section.id] = 0;
        }
        sectionScores[section.id] += questionScore;

        // Store question result for debugging
        questionResults.push({
          questionId: question.id,
          questionType: question.type,
          marks: question.marks,
          negativeMarks: question.negativeMarks,
          correctOptions: correctOptions.map(opt => opt.id),
          selectedOptions: selectedOptions,
          score: questionScore,
          isCorrect: isCorrect
        });
      }

      // Create or update report
      const existingReport = await this.Report.findOne({
        where: {
          userId: attempt.userId,
          assessmentId: attempt.assessmentId
        },
        transaction: t
      });

      let report;
      if (existingReport) {
        // Update existing report
        existingReport.score = totalScore;
        existingReport.sectionScores = sectionScores;
        await existingReport.save({ transaction: t });
        report = existingReport;
      } else {
        // Create new report
        report = await this.Report.create({
          userId: attempt.userId,
          assessmentId: attempt.assessmentId,
          score: totalScore,
          sectionScores: sectionScores
        }, { transaction: t });
      }

      // Mark attempt as completed
      attempt.status = 'completed';
      attempt.completedAt = new Date();
      await attempt.save({ transaction: t });

      await t.commit();

      // Invalidate related caches
      await redis.del(`attempt:${attemptId}`);
      await redis.del(`submissions:attempt:${attemptId}`);
              await redis.del(`reports:user:${attempt.userId}:assessment:${attempt.assessmentId}`);

      return res.status(200).json({
        data: {
          attemptId: attempt.id,
          status: attempt.status,
          completedAt: attempt.completedAt,
          totalScore: totalScore,
          sectionScores: sectionScores,
          reportId: report.id,
          questionResults: questionResults // For debugging/transparency
        },
        message: "Assessment submitted successfully"
      });

    } catch (err) {
      await t.rollback();
      return Utils.handleSequelizeError(err, res);
    }
  }

}

module.exports = SubmissionController;
