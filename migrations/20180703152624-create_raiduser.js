'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('raidusers', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED, 
        autoIncrement: true, 
        primaryKey: true
      },
      username: Sequelize.STRING(191),
      uid:  Sequelize.STRING(191),
      accounts:  { 
        type: Sequelize.INTEGER, defaultValue: 1
      },
      raidId: {
        type: Sequelize.INTEGER.UNSIGNED, references: {
          model: 'raids',
          key: 'id',
          onDelete: 'CASCADE'
        }
      },
      // Timestamps
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('users');
  }
};
