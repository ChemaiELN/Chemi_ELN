'use strict'

// Restores old's "Mandatory section for submission" checkbox — a per-template
// attachment flag (the same section can be required in one template and
// optional in another), so it belongs on ard_template_sections, not ard_sections.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ard_template_sections', 'is_mandatory', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ard_template_sections', 'is_mandatory')
  },
}
