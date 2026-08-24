'use strict'

// ArdProjectSpecification had no updated_by column, so the specification
// panel could never show who last edited a spec.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ard_project_specifications', 'updated_by', {
      type: Sequelize.STRING(200),
      allowNull: true,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ard_project_specifications', 'updated_by')
  },
}
