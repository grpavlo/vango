const { DataTypes, Model } = require('sequelize');
const db = require('../config/db');
const User = require('./user');

class SavedSearch extends Model {}

SavedSearch.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    driverId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    pickupCity: { type: DataTypes.STRING, allowNull: false },
    dropoffCity: { type: DataTypes.STRING },
    lat: { type: DataTypes.FLOAT, allowNull: false },
    lon: { type: DataTypes.FLOAT, allowNull: false },
    dropoffLat: { type: DataTypes.FLOAT },
    dropoffLon: { type: DataTypes.FLOAT },
    radius: { type: DataTypes.FLOAT, allowNull: false },
  },
  { sequelize: db, modelName: 'savedSearch' }
);

User.hasMany(SavedSearch, { foreignKey: 'driverId', as: 'savedSearches' });
SavedSearch.belongsTo(User, { foreignKey: 'driverId', as: 'driver' });

module.exports = SavedSearch;
