'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_uom_units', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      dimension_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_uom_dimensions', key: 'id' },
        onDelete: 'CASCADE',
      },
      symbol: { type: Sequelize.STRING(50), allowNull: false },
      name: { type: Sequelize.STRING(100), allowNull: true },
      factor_to_base: { type: Sequelize.DECIMAL(24, 12), allowNull: false, defaultValue: 1 },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_uom_units')
  },
}
