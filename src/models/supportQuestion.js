const { DataTypes, Model } = require('sequelize');
const db = require('../config/db');
const User = require('./user');

const SupportQuestionStatus = {
  OPEN: 'OPEN',
  ANSWERED: 'ANSWERED',
};

class SupportQuestion extends Model {}

SupportQuestion.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    question: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(SupportQuestionStatus)),
      allowNull: false,
      defaultValue: SupportQuestionStatus.OPEN,
    },
    answer: {
      type: DataTypes.TEXT,
    },
    photos: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    answeredAt: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize: db,
    modelName: 'supportQuestion',
  }
);

User.hasMany(SupportQuestion, { foreignKey: 'userId', as: 'supportQuestions' });
SupportQuestion.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = SupportQuestion;
module.exports.SupportQuestionStatus = SupportQuestionStatus;
