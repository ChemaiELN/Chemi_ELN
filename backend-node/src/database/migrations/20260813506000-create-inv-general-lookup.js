'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_general_lookup', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      lookup_type: { type: Sequelize.STRING(100), allowNull: false },
      lookup_value: { type: Sequelize.STRING(255), allowNull: false },
      lookup_code: { type: Sequelize.STRING(100), allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: Sequelize.STRING(200), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_general_lookup')
  },
}
