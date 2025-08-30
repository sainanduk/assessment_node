// models/externalcodingquestion.js
module.exports = (sequelize, DataTypes) => {
  const ExternalCodingQuestion = sequelize.define("ExternalCodingQuestion", {
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
    externalId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    difficulty: {
      type: DataTypes.STRING,
      allowNull: true
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: []
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
    tableName: "external_coding_questions",
    timestamps: true,
    indexes: [
      {
        name: "idx_externalcodingquestion_section",
        fields: ["sectionId"]
      },
      {
        name: "idx_externalcodingquestion_external_id",
        fields: ["externalId"]
      },
      {
        name: "idx_externalcodingquestion_difficulty",
        fields: ["difficulty"]
      }
    ]
  });

  return ExternalCodingQuestion;
};
