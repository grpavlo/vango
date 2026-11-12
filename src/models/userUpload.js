const { DataTypes, Model } = require('sequelize');
const db = require('../config/db');
class UserUpload extends Model {}
UserUpload.init({
  id: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
  userId: {type: DataTypes.INTEGER, allowNull: false},
  url: {type: DataTypes.STRING, allowNull: false, unique: true},
  writerLockKey: {type: DataTypes.STRING, allowNull: true},
  uploading: {type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true},
}, {sequelize: db, modelName: 'userUpload'});
module.exports = UserUpload;
