// models/proctoringSetting.js
module.exports = (sequelize, DataTypes) => {
  const ProctoringSetting = sequelize.define("ProctoringSetting", {
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
    enableProctoring: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    fullScreenRequired: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    disableCopyPaste: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    disableRightClick: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    tabSwitchDetection: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    maxTabSwitches: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    faceDetection: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    screenRecording: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    autoSubmitOnViolation: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    warningBeforeAction: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    settingsJson: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: "proctoring_settings",
    timestamps: false,
    indexes: [
      {
        name: "idx_proctoring_assessment",
        fields: ["assessmentId"]
      }
    ]
  });

  return ProctoringSetting;
};
