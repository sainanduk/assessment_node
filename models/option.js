// models/option.js
module.exports = (sequelize, DataTypes) => {
    const Option = sequelize.define("Option", {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      questionId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "questions",
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
        defaultValue: false
      },
      optionOrder: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      tableName: "question_options",
      timestamps: false,
      indexes: [
        {
          name: "idx_question_options_question",
          fields: ["questionId", "optionOrder"]
        }
      ]
      
    });
  
    // Associations are defined in models/index.js
  
    return Option;
  };
  