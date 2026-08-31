'use strict'

// Standalone flag reserved for future use — no behavior wired to it yet.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('inv_instrument_catalogue', 'has_column', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('inv_instrument_catalogue', 'has_column')
  },
}
