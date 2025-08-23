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
      instructions: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      totalMarks: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      totalDuration: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      passingMarks: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('draft', 'active', 'inactive', 'archived'),
        defaultValue: 'draft'
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
  