'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_usage_logs', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      target_kind: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'EQUIPMENT' },
      equipment_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_equipment_catalogue', key: 'id' },
        onDelete: 'CASCADE',
      },
      instrument_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_instrument_catalogue', key: 'id' },
        onDelete: 'CASCADE',
      },
      column_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_column_catalogue', key: 'id' },
        onDelete: 'CASCADE',
      },
      previous_product_code: { type: Sequelize.STRING(100), allowNull: true },
      previous_batch_no: { type: Sequelize.STRING(100), allowNull: true },
      reference_no: { type: Sequelize.STRING(100), allowNull: true },
      document_name: { type: Sequelize.STRING(255), allowNull: true },
      usage_remarks: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'IN_USE' },
      started_by: { type: Sequelize.STRING(200), allowNull: true },
      started_at: { type: Sequelize.DATE, allowNull: true },
      ended_by: { type: Sequelize.STRING(200), allowNull: true },
      ended_at: { type: Sequelize.DATE, allowNull: true },
      source: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'MANUAL' },
      experiment_id: { type: Sequelize.UUID, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_usage_logs')
  },
}
