'use strict'

// Lets a Test Group override a linked test's result-parameter Specification
// for that group's context only, without touching the shared Test
// Configuration record (which other groups may also link to).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ard_test_group_members', 'spec_overrides', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ard_test_group_members', 'spec_overrides')
  },
}
