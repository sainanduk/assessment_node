// controllers/ProctoringLogController.js
const { Op } = require("sequelize");
const Utils = require("./utils");
const redis = require("../config/redis");

class ProctoringLogController {
  constructor({ 
    sequelize, 
    ProctoringLog, 
    Attempt, 
    ProctoringSetting, 
    Submission, 
    Report,
    AssessmentAssignment,
    Assessment,
    Section,
    Question,
    Option,
    User
  }) {
    this.sequelize = sequelize;
    this.ProctoringLog = ProctoringLog;
    this.Attempt = Attempt;
    this.ProctoringSetting = ProctoringSetting;
    this.Submission = Submission;
    this.Report = Report;
    this.AssessmentAssignment = AssessmentAssignment;
    this.Assessment = Assessment;
    this.Section = Section;
    this.Question = Question;
    this.Option = Option;
    this.User = User;

    // Cache TTL configurations
    this.CACHE_TTL = {
      PROCTORING_SETTINGS: 3600, // 1 hour
      ASSESSMENT_DATA: 7200, // 2 hours
      VIOLATION_COUNTS: 300, // 5 minutes
      ATTEMPT_DATA: 1800 // 30 minutes
    };

    this.saveProctoringLogs = this.saveProctoringLogs.bind(this);
    this.checkViolationThreshold = this.checkViolationThreshold.bind(this);
    this.autoSubmitAndCalculateScore = this.autoSubmitAndCalculateScore.bind(this);
    this.calculateScore = this.calculateScore.bind(this);
  }

  // ---------- CACHE HELPER METHODS ----------
  async getCachedData(key) {
    try {
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error(`Cache read error for key ${key}:`, error);
      return null;
    }
  }

  async setCachedData(key, data, ttl = 3600) {
    try {
      await redis.setex(key, ttl, JSON.stringify(data));
    } catch (error) {
      console.error(`Cache write error for key ${key}:`, error);
    }
  }

  async deleteCachedData(key) {
    try {
      await redis.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  // ---------- CACHED PROCTORING SETTINGS ----------
  async getCachedProctoringSettings(assessmentId, transaction) {
    const cacheKey = `proctoring_settings:${assessmentId}`;
    
    let proctoringSettings = await this.getCachedData(cacheKey);
    
    if (!proctoringSettings) {
      proctoringSettings = await this.ProctoringSetting.findOne({
        where: { assessmentId },
        transaction
      });

      if (proctoringSettings) {
        await this.setCachedData(cacheKey, proctoringSettings, this.CACHE_TTL.PROCTORING_SETTINGS);
      }
    }

    return proctoringSettings;
  }

  // ---------- CACHED ATTEMPT DATA ----------
  async getCachedAttemptData(attemptId, transaction) {
    const cacheKey = `attempt_data:${attemptId}`;
    
    let attempt = await this.getCachedData(cacheKey);
    
    if (!attempt) {
      attempt = await this.Attempt.findByPk(attemptId, {
        include: [
          {
            model: this.AssessmentAssignment,
            as: "assignment",
            attributes: ["id", "assessmentId"]
          }
        ],
        transaction
      });

      if (attempt) {
        await this.setCachedData(cacheKey, attempt, this.CACHE_TTL.ATTEMPT_DATA);
      }
    }

    return attempt;
  }

  // ---------- CACHED VIOLATION COUNTS ----------
  async getCachedViolationCounts(attemptId) {
    const cacheKey = `violation_counts:${attemptId}`;
    return await this.getCachedData(cacheKey);
  }

  async updateCachedViolationCounts(attemptId, eventCounts) {
    const cacheKey = `violation_counts:${attemptId}`;
    await this.setCachedData(cacheKey, eventCounts, this.CACHE_TTL.VIOLATION_COUNTS);
  }

  // ---------- CACHED ASSESSMENT DATA ----------
  async getCachedAssessmentData(assessmentId, transaction) {
    const cacheKey = `assessment_data:${assessmentId}`;
    
    let assessment = await this.getCachedData(cacheKey);
    
    if (!assessment) {
      assessment = await this.Assessment.findByPk(assessmentId, {
        attributes: ['id', 'title', 'totalMarks', 'passingMarks'],
        include: [
          {
            model: this.Section,
            as: "sections",
            attributes: ['id', 'title', 'weightage'],
            include: [
              {
                model: this.Question,
                as: "questions",
                attributes: ['id', 'marks', 'negativeMarks', 'type'],
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
        ],
        transaction
      });

      if (assessment) {
        await this.setCachedData(cacheKey, assessment, this.CACHE_TTL.ASSESSMENT_DATA);
      }
    }

    return assessment;
  }

  // ---------- SAVE PROCTORING LOGS AND CHECK THRESHOLDS ----------
  async saveProctoringLogs(req, res) {
    const t = await this.sequelize.transaction();
    
    try {
      const { attemptId, logs } = req.body;
      
      // Basic validation
      if (!attemptId || !Array.isArray(logs) || logs.length === 0) {
        await t.rollback();
        return res.status(400).json({
          error: "ValidationError",
          details: "attemptId and logs array are required"
        });
      }

      // Validate attemptId
      if (isNaN(attemptId)) {
        await t.rollback();
        return res.status(400).json({
          error: "ValidationError",
          details: "attemptId must be a valid number"
        });
      }

      // Get cached attempt details
      const attempt = await this.getCachedAttemptData(attemptId, t);

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
          details: "Cannot log events for completed attempt"
        });
      }

      // Get cached proctoring settings
      const proctoringSettings = await this.getCachedProctoringSettings(
        attempt.assignment.assessmentId, 
        t
      );

      if (!proctoringSettings || !proctoringSettings.enableProctoring) {
        await t.rollback();
        return res.status(400).json({
          error: "ProctoringDisabled",
          details: "Proctoring is not enabled for this assessment",
          testEnded: false
        });
      }

      // Validate and save proctoring logs
      const logEntries = [];
      for (const log of logs) {
        if (!log.eventType || !log.timestamp) {
          await t.rollback();
          return res.status(400).json({
            error: "ValidationError",
            details: "Each log must have eventType and timestamp"
          });
        }

        logEntries.push({
          attemptId,
          eventType: log.eventType,
          timestamp: new Date(log.timestamp),
          metadata: log.metadata || null
        });
      }

      // Bulk create proctoring logs
      await this.ProctoringLog.bulkCreate(logEntries, { transaction: t });

      // Invalidate cached violation counts since we added new logs
      await this.deleteCachedData(`violation_counts:${attemptId}`);

      // Check violation thresholds
      const violationResult = await this.checkViolationThreshold(
        attemptId, 
        proctoringSettings, 
        t
      );

      if (violationResult.exceeded) {
        // Auto-submit attempt and calculate score
        const scoreResult = await this.autoSubmitAndCalculateScore(
          attempt,
          proctoringSettings,
          violationResult.violationType,
          t
        );

        // Invalidate cached attempt data
        await this.deleteCachedData(`attempt_data:${attemptId}`);

        await t.commit();

        return res.status(200).json({
          message: `Test auto-submitted due to ${violationResult.violationType} violation`,
          testEnded: true,
          violationType: violationResult.violationType,
          violationCount: violationResult.count,
          threshold: violationResult.threshold,
          score: scoreResult.score,
          percentage: scoreResult.percentage,
          isPassed: scoreResult.isPassed,
          reportId: scoreResult.reportId
        });
      }

      await t.commit();

      // Return success with warning if approaching threshold
      const warnings = this.generateWarnings(violationResult.eventCounts, proctoringSettings);

      return res.status(201).json({
        message: "Proctoring logs saved successfully",
        testEnded: false,
        logsCount: logEntries.length,
        warnings
      });

    } catch (err) {
      await t.rollback();
      return Utils.handleSequelizeError(err, res);
    }
  }

  // ---------- CHECK VIOLATION THRESHOLD WITH CACHING ----------
  async checkViolationThreshold(attemptId, proctoringSettings, transaction) {
    try {
      // Try to get cached violation counts
      let eventCounts = await this.getCachedViolationCounts(attemptId);
      
      if (!eventCounts) {
        // Get violation counts from database
        const violations = await this.ProctoringLog.findAll({
          where: { attemptId },
          attributes: [
            'eventType',
            [this.sequelize.fn('COUNT', this.sequelize.col('eventType')), 'count']
          ],
          group: ['eventType'],
          raw: true,
          transaction
        });

        eventCounts = {};
        violations.forEach(violation => {
          eventCounts[violation.eventType] = parseInt(violation.count);
        });

        // Cache the violation counts
        await this.updateCachedViolationCounts(attemptId, eventCounts);
      }

      // Check each violation type against thresholds
      const violationChecks = [
        {
          eventType: 'tab_switch',
          enabled: proctoringSettings.tabSwitchDetection,
          threshold: proctoringSettings.maxTabSwitches || 0
        },
        {
          eventType: 'face_not_detected',
          enabled: proctoringSettings.faceDetection,
          threshold: proctoringSettings.settingsJson?.maxFaceViolations || 5
        },
        {
          eventType: 'copy_paste_detected',
          enabled: proctoringSettings.disableCopyPaste,
          threshold: proctoringSettings.settingsJson?.maxCopyPasteViolations || 3
        },
        {
          eventType: 'right_click_detected',
          enabled: proctoringSettings.disableRightClick,
          threshold: proctoringSettings.settingsJson?.maxRightClickViolations || 10
        },
        {
          eventType: 'suspicious_activity',
          enabled: true,
          threshold: proctoringSettings.settingsJson?.maxSuspiciousActivities || 1
        }
      ];

      // Check if any threshold is exceeded
      for (const check of violationChecks) {
        if (check.enabled && eventCounts[check.eventType] > check.threshold) {
          return {
            exceeded: true,
            violationType: check.eventType,
            count: eventCounts[check.eventType],
            threshold: check.threshold,
            eventCounts
          };
        }
      }

      return {
        exceeded: false,
        eventCounts
      };

    } catch (error) {
      console.error("Error checking violation threshold:", error);
      return { exceeded: false, eventCounts: {} };
    }
  }

  // ---------- AUTO SUBMIT AND CALCULATE SCORE ----------
  async autoSubmitAndCalculateScore(attempt, proctoringSettings, violationType, transaction) {
    try {
      const currentTime = new Date(new Date()+ 5.5 * 60 * 60 * 1000);
      const timeSpent = Math.floor((currentTime - new Date(attempt.startedAt)) / 1000);

      // Update attempt status to auto_submitted
      await attempt.update({
        status: 'auto_submitted',
        submittedAt: currentTime,
        totalTimeSpent: timeSpent
      }, { transaction });

      // Calculate score using the score calculation logic
      const scoreResult = await this.calculateScore(attempt.id, transaction);

      return scoreResult;

    } catch (error) {
      console.error("Error in auto-submit and calculate score:", error);
      throw error;
    }
  }

  // ---------- CALCULATE SCORE WITH CACHING ----------
  async calculateScore(attemptId, transaction) {
    try {
      // Get cached attempt data
      const attempt = await this.getCachedAttemptData(attemptId, transaction);

      // Get cached assessment data
      const assessment = await this.getCachedAssessmentData(
        attempt.assignment.assessmentId, 
        transaction
      );

      // Get submissions (these change frequently, so don't cache)
      const submissions = await this.Submission.findAll({
        where: { attemptId },
        attributes: ['questionId', 'selectedOptions'],
        transaction
      });

      // Calculate basic score (simplified scoring logic)
      let totalScore = 0;
      let maxPossibleScore = 0;
      const sectionScores = {};
      let correctAnswers = 0;
      let totalQuestions = 0;

      assessment.sections.forEach(section => {
        sectionScores[section.id] = 0;
        
        section.questions.forEach(question => {
          totalQuestions++;
          const questionMarks = question.marks || 1;
          const sectionWeightage = section.weightage || 1;
          const weightedMarks = questionMarks * sectionWeightage;
          
          maxPossibleScore += weightedMarks;

          // Find submission for this question
          const submission = submissions.find(sub => sub.questionId === question.id);
          
          if (submission && submission.selectedOptions && submission.selectedOptions.length > 0) {
            // Get correct options
            const correctOptions = question.options
              .filter(option => option.isCorrect)
              .map(option => option.id);

            // Simple scoring - exact match for single/multiple choice
            let isCorrect = false;
            if (question.type === 'single_choice') {
              isCorrect = correctOptions.length === 1 && 
                         submission.selectedOptions.length === 1 && 
                         correctOptions.includes(submission.selectedOptions[0]);
            } else if (question.type === 'multiple_choice') {
              const selectedSet = new Set(submission.selectedOptions);
              const correctSet = new Set(correctOptions);
              isCorrect = selectedSet.size === correctSet.size && 
                         [...selectedSet].every(id => correctSet.has(id));
            }

            if (isCorrect) {
              totalScore += weightedMarks;
              sectionScores[section.id] += weightedMarks;
              correctAnswers++;
            } else {
              // Apply negative marking if any
              const negativeMarks = question.negativeMarks || 0;
              totalScore -= negativeMarks * sectionWeightage;
              sectionScores[section.id] -= negativeMarks * sectionWeightage;
            }
          }
        });

        // Ensure section score is not negative
        sectionScores[section.id] = Math.max(0, sectionScores[section.id]);
        sectionScores[section.id] = Math.round(sectionScores[section.id] * 100) / 100;
      });

      // Apply proctoring penalties
      const proctoringPenalty = await this.calculateProctoringPenalty(attemptId);
      const finalScore = Math.max(0, totalScore - proctoringPenalty);

      // Calculate percentage
      const percentage = maxPossibleScore > 0 ? 
        Math.round((finalScore / maxPossibleScore) * 10000) / 100 : 0;

      // Determine pass/fail
      const isPassed = finalScore >= (assessment.passingMarks || 0);

      // Create or update report
      const reportData = {
        userId: attempt.userId,
        assessmentAssignmentId: attempt.assignmentId,
        assessmentId: attempt.assignment.assessmentId,
        score: Math.round(finalScore * 100) / 100,
        sectionScores
      };

      const existingReport = await this.Report.findOne({
        where: {
          userId: attempt.userId,
          assessmentAssignmentId: attempt.assignmentId
        },
        transaction
      });

      let report;
      if (existingReport) {
        await existingReport.update(reportData, { transaction });
        report = existingReport;
      } else {
        report = await this.Report.create(reportData, { transaction });
      }

      return {
        score: Math.round(finalScore * 100) / 100,
        percentage,
        isPassed,
        correctAnswers,
        totalQuestions,
        maxPossibleScore,
        reportId: report.id
      };

    } catch (error) {
      console.error("Error calculating score:", error);
      throw error;
    }
  }

  // ---------- CALCULATE PROCTORING PENALTY WITH CACHING ----------
  async calculateProctoringPenalty(attemptId) {
    try {
      // Try to get cached violation counts first
      let eventCounts = await this.getCachedViolationCounts(attemptId);
      
      if (!eventCounts) {
        // Get violation counts from database if not cached
        const violations = await this.ProctoringLog.findAll({
          where: { attemptId },
          attributes: [
            'eventType',
            [this.sequelize.fn('COUNT', this.sequelize.col('eventType')), 'count']
          ],
          group: ['eventType'],
          raw: true
        });

        eventCounts = {};
        violations.forEach(violation => {
          eventCounts[violation.eventType] = parseInt(violation.count);
        });

        // Cache the violation counts
        await this.updateCachedViolationCounts(attemptId, eventCounts);
      }

      let totalPenalty = 0;

      Object.entries(eventCounts).forEach(([eventType, count]) => {
        let penaltyPerViolation = 0;
        
        switch (eventType) {
          case 'tab_switch':
            penaltyPerViolation = 2; // 2 marks penalty per tab switch
            break;
          case 'face_not_detected':
            penaltyPerViolation = 1; // 1 mark penalty per face detection failure
            break;
          case 'copy_paste_detected':
            penaltyPerViolation = 5; // 5 marks penalty per copy-paste
            break;
          case 'suspicious_activity':
            penaltyPerViolation = 10; // 10 marks penalty per suspicious activity
            break;
          default:
            penaltyPerViolation = 1;
        }

        totalPenalty += count * penaltyPerViolation;
      });

      return totalPenalty;
    } catch (error) {
      console.error("Error calculating proctoring penalty:", error);
      return 0;
    }
  }

  // ---------- GENERATE WARNINGS ----------
  generateWarnings(eventCounts, proctoringSettings) {
    const warnings = [];

    // Tab switch warning
    if (proctoringSettings.tabSwitchDetection && eventCounts.tab_switch) {
      const remaining = proctoringSettings.maxTabSwitches - eventCounts.tab_switch;
      if (remaining <= 2 && remaining > 0) {
        warnings.push(`Warning: ${remaining} tab switches remaining before auto-submission`);
      }
    }

    // Face detection warning
    if (proctoringSettings.faceDetection && eventCounts.face_not_detected) {
      const threshold = proctoringSettings.settingsJson?.maxFaceViolations || 5;
      const remaining = threshold - eventCounts.face_not_detected;
      if (remaining <= 2 && remaining > 0) {
        warnings.push(`Warning: ${remaining} face detection violations remaining`);
      }
    }

    return warnings;
  }

  // ---------- CACHE INVALIDATION METHODS ----------
  async invalidateAttemptCache(attemptId) {
    const keys = [
      `attempt_data:${attemptId}`,
      `violation_counts:${attemptId}`
    ];
    
    await Promise.all(keys.map(key => this.deleteCachedData(key)));
  }

  async invalidateAssessmentCache(assessmentId) {
    const keys = [
      `assessment_data:${assessmentId}`,
      `proctoring_settings:${assessmentId}`
    ];
    
    await Promise.all(keys.map(key => this.deleteCachedData(key)));
  }
}

module.exports = ProctoringLogController;
