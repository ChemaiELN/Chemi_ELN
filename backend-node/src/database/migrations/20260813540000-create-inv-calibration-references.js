'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_calibration_references', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      work_order_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_work_orders', key: 'id' },
        onDelete: 'CASCADE',
      },
      measurement_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_measurement_master', key: 'id' },
        onDelete: 'SET NULL',
      },
      measurement_name: { type: Sequelize.STRING(255), allowNull: true },
      reference_inst_id: { type: Sequelize.STRING(100), allowNull: true },
      reference_reading: { type: Sequelize.DECIMAL(14, 4), allowNull: true },
      instrument_reading: { type: Sequelize.DECIMAL(14, 4), allowNull: true },
      variance_pct: { type: Sequelize.DECIMAL(8, 4), allowNull: true },
      tolerance_pct: { type: Sequelize.DECIMAL(8, 4), allowNull: true },
      status: { type: Sequelize.STRING(10), allowNull: true },
      done_by: { type: Sequelize.STRING(200), allowNull: true },
      done_at: { type: Sequelize.DATE, allowNull: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_calibration_references')
  },
}
