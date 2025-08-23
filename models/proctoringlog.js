const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProctoringLog = sequelize.define('ProctoringLog', {
    logId: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    attemptId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'attempts',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    eventType: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'e.g., tab_switch, face_not_detected, suspicious_activity',
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'proctoringlogs',
    indexes: [
      { fields: ['attemptId'] },
      { fields: ['eventType'] },
    ],
    timestamps: false,
  });

  return ProctoringLog;
};