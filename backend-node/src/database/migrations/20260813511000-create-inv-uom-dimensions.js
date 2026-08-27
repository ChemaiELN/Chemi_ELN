'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_uom_dimensions', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      dimension_key: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      display_name: { type: Sequelize.STRING(200), allowNull: false },
      base_unit: { type: Sequelize.STRING(50), allowNull: false },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_uom_dimensions')
  },
}
