const { DataTypes, Model } = require('sequelize');
const db = require('../config/db');
class AccountDeletionJob extends Model {}
AccountDeletionJob.init({
  userId: { type: DataTypes.INTEGER, primaryKey: true },
  pendingFiles: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  completedAt: { type: DataTypes.DATE },
}, { sequelize: db, modelName: 'accountDeletionJob' });
module.exports = AccountDeletionJob;
