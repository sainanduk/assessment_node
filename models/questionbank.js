// models/questionbank.js
module.exports = (sequelize, DataTypes) => {
  const QuestionBank = sequelize.define("QuestionBank", {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true
    },
    questionText: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('single_correct', 'multi_correct'),
      allowNull: false,
      defaultValue: 'single_correct'
    },
    difficulty: {
      type: DataTypes.ENUM('easy', 'medium', 'hard'),
      allowNull: true
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true
    },
    tags: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: "question_bank",
    timestamps: false,
    indexes: [
      {
        name: "idx_questionbank_type",
        fields: ["type"]
      },
      {
        name: "idx_questionbank_difficulty",
        fields: ["difficulty"]
      },
      {
        name: "idx_questionbank_category",
        fields: ["category"]
      }
    ]
  });

  return QuestionBank;
};
