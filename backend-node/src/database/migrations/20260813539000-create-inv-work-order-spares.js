'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_work_order_spares', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      work_order_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_work_orders', key: 'id' },
        onDelete: 'CASCADE',
      },
      spare_part_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_spare_parts', key: 'id' },
        onDelete: 'SET NULL',
      },
      part_code: { type: Sequelize.STRING(100), allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_work_order_spares')
  },
}
