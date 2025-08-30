// models/option.js
module.exports = (sequelize, DataTypes) => {
  const Option = sequelize.define("Option", {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true
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
    optionText: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    isCorrect: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    optionOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: "options",
    timestamps: false,
    indexes: [
      {
        name: "idx_options_questionbank",
        fields: ["questionBankId", "optionOrder"]
      },
      {
        name: "idx_options_correct",
        fields: ["questionBankId", "isCorrect"]
      }
    ]
  });

  return Option;
};
  