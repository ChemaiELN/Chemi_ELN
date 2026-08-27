'use strict'

// Submitting a project specification for review now requires an
// e-signature (password re-auth) plus remarks explaining the submission —
// same pattern as experiment/test submit flows. Remarks are stored so the
// review history shows why it was submitted, not just that it was.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ard_project_specifications', 'submit_remarks', {
      type: Sequelize.TEXT,
      allowNull: true,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ard_project_specifications', 'submit_remarks')
  },
}
