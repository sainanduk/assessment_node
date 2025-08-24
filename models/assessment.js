// models/assessment.js
module.exports = (sequelize, DataTypes) => {
    const Assessment = sequelize.define("Assessment", {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 85,
        comment: 'Duration in minutes'
      },
      total_questions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      passing_score: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      instructions: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      is_proctored: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      status: {
        type: DataTypes.ENUM('draft', 'active', 'inactive', 'archived'),
        defaultValue: 'draft'
      },
      difficulty: {
        type: DataTypes.ENUM('easy', 'medium', 'hard'),
        defaultValue: 'medium'
      },
      time_limit: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      show_results: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      shuffle_questions: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      shuffle_options: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      totalMarks: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100
      },
      attemptsAllowed: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      type: {
        type: DataTypes.ENUM('quiz', 'exam', 'assignment','assessment'),
        allowNull: false,
        defaultValue: 'assignment'
      },
      startTime: {
        type: DataTypes.DATE,
        allowNull: true
      },
      endTime: {
        type: DataTypes.DATE,
        allowNull: true
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
      tableName: "assessments",
      timestamps: true
    });
  
    // Associations are defined in models/index.js
  
    return Assessment;
  };
  