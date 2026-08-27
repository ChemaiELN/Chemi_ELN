'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_storage_conditions', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      label: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      temperature_min: { type: Sequelize.DECIMAL(6, 1), allowNull: true },
      temperature_max: { type: Sequelize.DECIMAL(6, 1), allowNull: true },
      temperature_unit: { type: Sequelize.STRING(10), allowNull: false, defaultValue: '°C' },
      description: { type: Sequelize.TEXT, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_storage_conditions')
  },
}
