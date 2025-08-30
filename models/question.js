// models/question.js
module.exports = (sequelize, DataTypes) => {
    const Question = sequelize.define("Question", {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      sectionId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "sections",
          key: "id"
        },
        onDelete: "CASCADE"
      },
      questionBankId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "question_bank",
          key: "id"
        },
        onDelete: "CASCADE"
      },
      questionOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      marks: {
        type: DataTypes.FLOAT,
        allowNull: true // Override question bank's default marks if needed
      },
      negativeMarks: {
        type: DataTypes.DECIMAL(3,2),
        allowNull: true // Override question bank's default negative marks if needed
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      tableName: "questions",
      timestamps: false,
      indexes: [
        {
          name: "idx_questions_section",
          fields: ["sectionId", "questionOrder"]
        },
        {
          name: "idx_questions_questionbank",
          fields: ["questionBankId"]
        }
      ]
    });
  
    // Associations are defined in models/index.js
  
    return Question;
  };
  