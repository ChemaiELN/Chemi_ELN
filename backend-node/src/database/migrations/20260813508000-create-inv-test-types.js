'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_test_types', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      type_key: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_test_types')
  },
}
