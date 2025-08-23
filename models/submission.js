// models/submission.js
module.exports = (sequelize, DataTypes) => {
    const Submission = sequelize.define("Submission", {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      attemptId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "attempts",
          key: "id"
        },
        onDelete: "CASCADE"
      },
      questionId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "questions",
          key: "id"
        }
      },
      selectedOptions: {
        type: DataTypes.ARRAY(DataTypes.BIGINT),
        allowNull: true
      },
      submittedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      tableName: "submissions",
      timestamps: false,
      indexes: [
        {
          name: "idx_submissions_attempt",
          fields: ["attemptId"]
        },
        {
          name: "idx_submissions_question",
          fields: ["questionId"]
        }
      ]
      
    });
  
    // Associations are defined in models/index.js
  
    return Submission;
  };
  