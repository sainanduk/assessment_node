// models/section.js
module.exports = (sequelize, DataTypes) => {
    const Section = sequelize.define("Section", {
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
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      sectionOrder: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      marks: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      timeLimit: {
        type: DataTypes.INTEGER,
        allowNull: true // in minutes
      },
      instructions: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      tableName: "sections",
      timestamps: false,
      indexes: [
        {
          name: "idx_sections_assessment",
          fields: ["assessmentId", "sectionOrder"]
        }
      ]
      
    });
  
    // Associations are defined in models/index.js
  
    return Section;
  };
  