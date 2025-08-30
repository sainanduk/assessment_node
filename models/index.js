const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Import model definitions
const User = require('./users')(sequelize, DataTypes);
const Assessment = require('./assessment')(sequelize, DataTypes);
const Section = require('./section')(sequelize, DataTypes);
const Question = require('./question')(sequelize, DataTypes);
const QuestionBank = require('./questionbank')(sequelize, DataTypes);
const ExternalCodingQuestion = require('./externalcodingquestion')(sequelize, DataTypes);
const Option = require('./option')(sequelize, DataTypes);
const Attempt = require('./attempt')(sequelize, DataTypes);
const Batch = require('./batch')(sequelize, DataTypes);
const Institute = require('./institute')(sequelize, DataTypes);
const ProctoringSetting = require('./proctoringsetting')(sequelize, DataTypes);
const Submission = require('./submission')(sequelize, DataTypes);
const Report = require('./report')(sequelize, DataTypes);
const ProctoringLog = require('./proctoringlog')(sequelize, DataTypes); 

// Define associations
// User - Assessment (One-to-Many)


// Assessment - Section (One-to-Many)
Assessment.hasMany(Section, { foreignKey: 'assessmentId', as: 'sections' });
Section.belongsTo(Assessment, { foreignKey: 'assessmentId' });

// Section - Question (One-to-Many) - for MCQ questions
Section.hasMany(Question, { foreignKey: 'sectionId', as: 'questions' });
Question.belongsTo(Section, { foreignKey: 'sectionId' });

// Section - ExternalCodingQuestion (One-to-Many) - for coding questions
Section.hasMany(ExternalCodingQuestion, { foreignKey: 'sectionId', as: 'externalCodingQuestions' });
ExternalCodingQuestion.belongsTo(Section, { foreignKey: 'sectionId' });

// Question - QuestionBank (Many-to-One)
Question.belongsTo(QuestionBank, { foreignKey: 'questionBankId', as: 'questionBank' });
QuestionBank.hasMany(Question, { foreignKey: 'questionBankId', as: 'questions' });

// QuestionBank - Option (One-to-Many)
QuestionBank.hasMany(Option, { foreignKey: 'questionBankId', as: 'options' });
Option.belongsTo(QuestionBank, { foreignKey: 'questionBankId' });

// Question - Submission (One-to-Many)
Question.hasMany(Submission, { foreignKey: 'questionId', as: 'submissions' });
Submission.belongsTo(Question, { foreignKey: 'questionId' });

// Assessment - Attempt (One-to-Many)
Assessment.hasMany(Attempt, { foreignKey: 'assessmentId', as: 'attempts' });
Attempt.belongsTo(Assessment, { foreignKey: 'assessmentId' });

// Batch - User (One-to-Many)
Batch.hasMany(User, { foreignKey: 'batchId' });
User.belongsTo(Batch, { foreignKey: 'batchId' });

// Institute - Batch (One-to-Many)
Institute.hasMany(Batch, { foreignKey: 'instituteId' });
Batch.belongsTo(Institute, { foreignKey: 'instituteId' });

// User - Attempt (One-to-Many)
User.hasMany(Attempt, { foreignKey: 'userId' });
Attempt.belongsTo(User, { foreignKey: 'userId' });

// Attempt - ProctoringLog (One-to-Many)
Attempt.hasMany(ProctoringLog, { foreignKey: 'attemptId', as: 'proctoringLogs' });
ProctoringLog.belongsTo(Attempt, { foreignKey: 'attemptId', as: 'attempt' });

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

// Report associations
User.hasMany(Report, { foreignKey: 'userId' });
Report.belongsTo(User, { foreignKey: 'userId' });

Assessment.hasMany(Report, { foreignKey: 'assessmentId' });
Report.belongsTo(Assessment, { foreignKey: 'assessmentId' });

// Export models and sequelize instance
const models = {
  User,
  Assessment,
  Section,
  Question,
  QuestionBank,
  ExternalCodingQuestion,
  Option,
  Attempt,
  Batch,
  Institute,
  ProctoringSetting,
  Submission,
  Report,
  ProctoringLog,
  sequelize,
  Sequelize
};

module.exports = models;
