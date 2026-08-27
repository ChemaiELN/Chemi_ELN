'use strict'

// A test's team is normally implied by its parent ATR's assigned_tl_id — but
// the HOD's "Re-assign Test" tool moves individual tests to a different team
// without touching sibling tests on the same ATR, so a test needs its own
// override once it's been moved this way.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ard_test_requests', 'reassigned_tl_id', {
      type: Sequelize.UUID,
      allowNull: true,
    })
    await queryInterface.addColumn('ard_test_requests', 'reassigned_tl_name', {
      type: Sequelize.STRING,
      allowNull: true,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ard_test_requests', 'reassigned_tl_id')
    await queryInterface.removeColumn('ard_test_requests', 'reassigned_tl_name')
  },
}
