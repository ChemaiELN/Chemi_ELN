'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_work_order_results', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      work_order_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_work_orders', key: 'id' },
        onDelete: 'CASCADE',
      },
      checklist_item_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_checklist_items', key: 'id' },
        onDelete: 'SET NULL',
      },
      observation: { type: Sequelize.STRING(255), allowNull: true },
      comment: { type: Sequelize.TEXT, allowNull: true },
      done_by: { type: Sequelize.STRING(200), allowNull: true },
      done_at: { type: Sequelize.DATE, allowNull: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_work_order_results')
  },
}
