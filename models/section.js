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
      type: {
        type: DataTypes.ENUM('coding', 'noncoding'),
        allowNull: false,
        defaultValue: 'noncoding'
      },
      sectionOrder: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      marks: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      question_count: {
        type: DataTypes.INTEGER,
        defaultValue: 1
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
        },
        {
          name: "idx_sections_type",
          fields: ["type"]
        }
      ]
      
    });
  
    // Associations are defined in models/index.js
  
    return Section;
  };
  