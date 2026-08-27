'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_stock_request_events', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      request_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_stock_requests', key: 'id' },
        onDelete: 'CASCADE',
      },
      event_type: { type: Sequelize.STRING(30), allowNull: false },
      performed_by: { type: Sequelize.STRING(200), allowNull: false },
      performed_at: { type: Sequelize.DATE, allowNull: false },
      remarks: { type: Sequelize.TEXT, allowNull: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_stock_request_events')
  },
}
