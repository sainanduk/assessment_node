const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Import model definitions
const User = require('./users')(sequelize, DataTypes);
const Assessment = require('./assessment')(sequelize, DataTypes);
const Section = require('./section')(sequelize, DataTypes);
const Question = require('./question')(sequelize, DataTypes);
const Option = require('./option')(sequelize, DataTypes);
const AssessmentAssignment = require('./assessmentassignment')(sequelize, DataTypes);
const Attempt = require('./attempt')(sequelize, DataTypes);
const Batch = require('./batch')(sequelize, DataTypes);
const Institute = require('./institute')(sequelize, DataTypes);
const ProctoringSetting = require('./proctoringsetting')(sequelize, DataTypes);
const Submission = require('./submission')(sequelize, DataTypes);
const Report = require('./report')(sequelize, DataTypes); // 🔹 import Report
const ProctoringLog = require('./proctoringlog')(sequelize, DataTypes); 
// Define associations
// User - Assessment (One-to-Many)
User.hasMany(Assessment, { foreignKey: 'userId' });
Assessment.belongsTo(User, { foreignKey: 'userId' });

// Assessment - Section (One-to-Many)
Assessment.hasMany(Section, { foreignKey: 'assessmentId', as: 'sections' });
Section.belongsTo(Assessment, { foreignKey: 'assessmentId' });

// Section - Question (One-to-Many)
Section.hasMany(Question, { foreignKey: 'sectionId', as: 'questions' });
Question.belongsTo(Section, { foreignKey: 'sectionId' });

// Question - Option (One-to-Many)
Question.hasMany(Option, { foreignKey: 'questionId', as: 'options' });
Option.belongsTo(Question, { foreignKey: 'questionId' });

// Assessment - AssessmentAssignment (One-to-Many)
Assessment.hasMany(AssessmentAssignment, { foreignKey: 'assessmentId' });
AssessmentAssignment.belongsTo(Assessment, { foreignKey: 'assessmentId', as: 'Assessment' });

// AssessmentAssignment - Attempt (One-to-Many)
AssessmentAssignment.hasMany(Attempt, { foreignKey: 'assignmentId', as: 'Attempts' });
Attempt.belongsTo(AssessmentAssignment, { foreignKey: 'assignmentId' });

// Batch - User (One-to-Many)
Batch.hasMany(User, { foreignKey: 'batchId' });
User.belongsTo(Batch, { foreignKey: 'batchId' });

// Institute - Batch (One-to-Many)
Institute.hasMany(Batch, { foreignKey: 'instituteId' });
Batch.belongsTo(Institute, { foreignKey: 'instituteId' });

// 🔹 Associations for Reports
User.hasMany(Report, { foreignKey: 'userId' });
Report.belongsTo(User, { foreignKey: 'userId' });

AssessmentAssignment.hasMany(Report, { foreignKey: 'assessmentAssignmentId' });
Report.belongsTo(AssessmentAssignment, { foreignKey: 'assessmentAssignmentId' });

Assessment.hasMany(Report, { foreignKey: 'assessmentId' });
Report.belongsTo(Assessment, { foreignKey: 'assessmentId' });


// ProctoringSetting - Attempt (One-to-Many)
Attempt.hasMany(ProctoringLog, {foreignKey: 'attemptId',as: 'proctoringLogs'});

ProctoringLog.belongsTo(Attempt, {foreignKey: 'attemptId',as: 'attempt'});
// Export models and sequelize instance

// Assessment - ProctoringSetting (One-to-One)
Assessment.hasOne(ProctoringSetting, {
  foreignKey: 'assessmentId',
  as: 'proctoring_settings',
  onDelete: 'CASCADE'
});

ProctoringSetting.belongsTo(Assessment, {
  foreignKey: 'assessmentId',
  as: 'Assessment'
});
const models = {
  User,
  Assessment,
  Section,
  Question,
  Option,
  AssessmentAssignment,
  Attempt,
  Batch,
  Institute,
  ProctoringSetting,
  Submission,
  Report, // 🔹 export Report
  ProctoringLog,
  sequelize,
  Sequelize
};

module.exports = models;
