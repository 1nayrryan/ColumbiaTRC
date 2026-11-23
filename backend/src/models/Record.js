const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const TrcRecord = sequelize.define("TrcRecord", {
  country: { type: DataTypes.STRING, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  caseType: { type: DataTypes.STRING, allowNull: false },
  severity: { type: DataTypes.STRING, allowNull: false },
  documentUrl: { type: DataTypes.STRING, allowNull: true },
});

module.exports = TrcRecord;
