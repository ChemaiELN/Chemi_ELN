'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_work_orders', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      workorder_no: { type: Sequelize.STRING(50), allowNull: false, unique: true },
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
      schedule_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_schedules', key: 'id' },
        onDelete: 'SET NULL',
      },
      checklist_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_checklists', key: 'id' },
        onDelete: 'SET NULL',
      },
      kind: { type: Sequelize.STRING(20), allowNull: false },
      log_type: { type: Sequelize.STRING(30), allowNull: false },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'RAISED' },
      deviation: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      maintenance_type: { type: Sequelize.STRING(10), allowNull: true },
      breakdown_description: { type: Sequelize.TEXT, allowNull: true },
      spare_parts_used: { type: Sequelize.BOOLEAN, allowNull: true },
      calibration_source: { type: Sequelize.STRING(10), allowNull: true },
      certificate_no: { type: Sequelize.STRING(100), allowNull: true },
      checklist_snapshot: { type: Sequelize.JSONB, allowNull: true },
      raised_by: { type: Sequelize.STRING(200), allowNull: true },
      raised_at: { type: Sequelize.DATE, allowNull: true },
      started_by: { type: Sequelize.STRING(200), allowNull: true },
      started_at: { type: Sequelize.DATE, allowNull: true },
      ended_by: { type: Sequelize.STRING(200), allowNull: true },
      ended_at: { type: Sequelize.DATE, allowNull: true },
      verified_by: { type: Sequelize.STRING(200), allowNull: true },
      verified_at: { type: Sequelize.DATE, allowNull: true },
      approved_by: { type: Sequelize.STRING(200), allowNull: true },
      approved_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_work_orders')
  },
}
