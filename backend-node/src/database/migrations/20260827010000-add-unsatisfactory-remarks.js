'use strict'

// The "Mark Unsatisfactory" action already lets the user type a remark
// (ArdTestsPage.tsx sends { remarks } to POST /:atrId/:testId/unsatisfactory)
// but the route has never had a column to persist it into — see the route fix.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ard_test_requests', 'unsatisfactory_remarks', {
      type: Sequelize.TEXT,
      allowNull: true,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ard_test_requests', 'unsatisfactory_remarks')
  },
}
