// models/batch.js
module.exports = (sequelize, DataTypes) => {
    const Batch = sequelize.define("Batch", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      instituteId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "institutes",
          key: "id"
        },
        onDelete: "CASCADE"
      }
    }, {
      tableName: "batches",
      timestamps: false,
      indexes: [
        {
          name: "idx_batches_institute",
          fields: ["instituteId"]
        }
      ]
      
    });
  
    // Associations are defined in models/index.js
  
    return Batch;
  };
  
  