'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_log_mappings', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
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
      log_type: { type: Sequelize.STRING(30), allowNull: false },
      checklist_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_checklists', key: 'id' },
        onDelete: 'SET NULL',
      },
      tolerance_days: { type: Sequelize.INTEGER, allowNull: true },
      alert_limit: { type: Sequelize.INTEGER, allowNull: true },
      deviation_limit: { type: Sequelize.INTEGER, allowNull: true },
      created_by: { type: Sequelize.STRING(200), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_log_mappings')
  },
}
