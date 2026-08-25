'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_batch_events', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      batch_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_batches', key: 'id' },
        onDelete: 'CASCADE',
      },
      event_type: { type: Sequelize.STRING(30), allowNull: false },
      qty: { type: Sequelize.DECIMAL(12, 4), allowNull: true },
      ref_no: { type: Sequelize.STRING(100), allowNull: true },
      module: { type: Sequelize.STRING(100), allowNull: true },
      issued_to: { type: Sequelize.STRING(200), allowNull: true },
      purpose: { type: Sequelize.STRING(500), allowNull: true },
      project_code: { type: Sequelize.STRING(100), allowNull: true },
      performed_by: { type: Sequelize.STRING(200), allowNull: false },
      performed_at: { type: Sequelize.DATE, allowNull: false },
      remarks: { type: Sequelize.TEXT, allowNull: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_batch_events')
  },
}
