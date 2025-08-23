// models/institute.js
module.exports = (sequelize, DataTypes) => {
    const Institute = sequelize.define("Institute", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      }
    }, {
      tableName: "institutes",
      timestamps: false
    });
  
  
    return Institute;
  };
  