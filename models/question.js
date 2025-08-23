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
      questionText: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      marks: {
        type: DataTypes.INTEGER,
        defaultValue: 1
      },
      negativeMarks: {
        type: DataTypes.DECIMAL(3,2),
        defaultValue: 0
      },
      type: {
        type: DataTypes.ENUM('single_correct', 'multi_correct', 'coding'),
        allowNull: false,
        defaultValue: 'single_correct'
      },
      metadata: {
        type: DataTypes.JSONB, // for coding question details or other extra info
        allowNull: true
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
          fields: ["sectionId"]
        }
      ]
      
    });
  
    // Associations are defined in models/index.js
  
    return Question;
  };
  