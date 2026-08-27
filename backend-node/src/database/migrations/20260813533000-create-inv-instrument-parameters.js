'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_instrument_parameters', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      instrument_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_instrument_catalogue', key: 'id' },
        onDelete: 'CASCADE',
      },
      measurement_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_measurement_master', key: 'id' },
        onDelete: 'SET NULL',
      },
      measurement_name: { type: Sequelize.STRING(255), allowNull: true },
      precision: { type: Sequelize.INTEGER, allowNull: true },
      lower_unit: { type: Sequelize.DECIMAL(14, 4), allowNull: true },
      lower_uom: { type: Sequelize.STRING(50), allowNull: true },
      upper_unit: { type: Sequelize.DECIMAL(14, 4), allowNull: true },
      upper_uom: { type: Sequelize.STRING(50), allowNull: true },
      calibration_tolerance_pct: { type: Sequelize.DECIMAL(8, 4), allowNull: true },
      seq_no: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      created_at: { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_instrument_parameters')
  },
}
