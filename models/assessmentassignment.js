// models/assessmentAssignment.js
module.exports = (sequelize, DataTypes) => {
  const AssessmentAssignment = sequelize.define("AssessmentAssignment", {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true
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
    instituteId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: "institutes",
        key: "id"
      },
      onDelete: "CASCADE"
    },
    batchId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: "batches",
        key: "id"
      },
      onDelete: "CASCADE"
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: "assessment_assignments",
    timestamps: false,
    indexes: [
      {
        name: "idx_assignments_institute_batch",
        fields: ["instituteId", "batchId"]
      }
    ]
  });

  return AssessmentAssignment;
};
