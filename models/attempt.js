// models/attempt.js
module.exports = (sequelize, DataTypes) => {
    const Attempt = sequelize.define("Attempt", {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      assignmentId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "assessment_assignments",
          key: "id"
        }
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "userId"
        }
      },
      attemptNumber: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      startedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      submittedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('in_progress', 'submitted', 'auto_submitted', 'abandoned'),
        allowNull: false,
        defaultValue: 'in_progress'
      },
      ipAddress: {
        type: DataTypes.INET,
        allowNull: true
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      totalTimeSpent: {
        type: DataTypes.INTEGER,
        allowNull: true // in seconds
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      tableName: "attempts",
      timestamps: false,
      indexes: [
        {
          name: "idx_attempts_assignment_user",
          fields: ["assignmentId", "userId"]
        },
        {
          name: "idx_attempts_status",
          fields: ["status"]
        }
      ]
      
    });
  
    // Associations are defined in models/index.js
  
    return Attempt;
  };
  