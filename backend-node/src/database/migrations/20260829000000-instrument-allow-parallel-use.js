'use strict'

// Instruments that support running concurrent usage sessions (e.g. multi-slot
// incubators) can be flagged "Parallel Use" so the availability gate doesn't
// block a new session just because another one is already ACTIVE.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('inv_instrument_catalogue', 'allow_parallel_use', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('inv_instrument_catalogue', 'allow_parallel_use')
  },
}
