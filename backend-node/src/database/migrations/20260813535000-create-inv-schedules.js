'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_schedules', {
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
      log_type: { type: Sequelize.STRING(30), allowNull: false },
      checklist_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_checklists', key: 'id' },
        onDelete: 'SET NULL',
      },
      schedule_type: { type: Sequelize.STRING(20), allowNull: false },
      due_date: { type: Sequelize.DATEONLY, allowNull: false },
      planned_date: { type: Sequelize.DATEONLY, allowNull: true },
      calibration_source: { type: Sequelize.STRING(10), allowNull: true },
      tolerance_days: { type: Sequelize.INTEGER, allowNull: true },
      alert_limit: { type: Sequelize.INTEGER, allowNull: true },
      deviation_limit: { type: Sequelize.INTEGER, allowNull: true },
      done_on: { type: Sequelize.DATEONLY, allowNull: true },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'DUE' },
      source: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'MANUAL' },
      created_by: { type: Sequelize.STRING(200), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_schedules')
  },
}
