'use strict'

// New Instrument creation needs Calibration Type (Internal/External), a
// value+unit Calibration Frequency, and — same as Equipment already has —
// Last/Next Maintenance Date fields (instruments can also be tracked for
// general maintenance alongside calibration).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('inv_instrument_catalogue', 'calibration_type', {
      type: Sequelize.STRING(10),
      allowNull: true,
    })
    await queryInterface.addColumn('inv_instrument_catalogue', 'calibration_frequency_value', {
      type: Sequelize.INTEGER,
      allowNull: true,
    })
    await queryInterface.addColumn('inv_instrument_catalogue', 'calibration_frequency_unit', {
      type: Sequelize.STRING(20),
      allowNull: true,
    })
    await queryInterface.addColumn('inv_instrument_catalogue', 'last_maintenance_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    })
    await queryInterface.addColumn('inv_instrument_catalogue', 'next_maintenance_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('inv_instrument_catalogue', 'next_maintenance_date')
    await queryInterface.removeColumn('inv_instrument_catalogue', 'last_maintenance_date')
    await queryInterface.removeColumn('inv_instrument_catalogue', 'calibration_frequency_unit')
    await queryInterface.removeColumn('inv_instrument_catalogue', 'calibration_frequency_value')
    await queryInterface.removeColumn('inv_instrument_catalogue', 'calibration_type')
  },
}
