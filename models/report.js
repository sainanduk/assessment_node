// models/report.js
module.exports = (sequelize, DataTypes) => {
    const Report = sequelize.define("Report", {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "userId"
        },
        onDelete: "CASCADE"
      },
      assessmentId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "assessments",
          key: "id"
        },
        onDelete: "CASCADE"
      },
      score: {
        type: DataTypes.DECIMAL(6,2),
        allowNull: true
      },
      sectionScores: {
        type: DataTypes.JSONB,  // sectionId → score mapping
        allowNull: true,
        defaultValue: {}
        /*
          Example:
          {
            "sectionId1": 5,
            "sectionId2": 10
          }
        */
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      tableName: "reports",
      timestamps: true,
      indexes: [
        {
          name: "idx_reports_user_assessment",
          fields: ["userId", "assessmentId"]
        },
        {
          name: "idx_reports_assessment",
          fields: ["assessmentId"]
        }
      ]
    });
  
    return Report;
  };
  