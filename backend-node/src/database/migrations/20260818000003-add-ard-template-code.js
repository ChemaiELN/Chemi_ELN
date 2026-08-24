'use strict'

// ArdTemplate had no real user-entered code column — the UI faked one by
// slicing the record's UUID, which isn't stable or user-meaningful.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ard_templates', 'code', {
      type: Sequelize.STRING(50),
      allowNull: true,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ard_templates', 'code')
  },
}
