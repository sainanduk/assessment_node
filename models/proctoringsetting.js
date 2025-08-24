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
    voice_monitoring: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    face_proctoring: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    electronic_monitoring: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    is_fullscreen: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    auto_terminate: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    termination_threshold: {
      type: DataTypes.INTEGER,
      defaultValue: 5
    },
    warning_threshold: {
      type: DataTypes.INTEGER,
      defaultValue: 3
    },
    max_tab_switches: {
      type: DataTypes.INTEGER,
      defaultValue: 3
    },
    max_face_not_detected_time: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
      comment: 'Time in seconds'
    },
    max_voice_detected_time: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
      comment: 'Time in seconds'
    },
    max_multiple_faces_time: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
      comment: 'Time in seconds'
    },
    notification_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ''
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
