// models/Users.js
module.exports = (sequelize, DataTypes) => {
  const Users = sequelize.define(
    "Users",
    {
      userId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        
        primaryKey: true
      },

      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },

      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
      },
      instituteId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "institutes", key: "id" }
      },

      batchId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "batches", key: "id" }
      }
    },
    {
      tableName: "Users",
      timestamps: true,

      indexes: [
        {
          name: "idx_users_institute_batch",
          fields: ["instituteId", "batchId"]
        }
      ]
    }
  );

  return Users;
};
