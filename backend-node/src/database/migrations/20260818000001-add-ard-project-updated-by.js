'use strict'

// ArdProject had no updated_by column at all, so the Node "Updated By" column
// always fell back to createdBy — the value never actually changed after edits.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ard_projects', 'updated_by', {
      type: Sequelize.STRING(200),
      allowNull: true,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ard_projects', 'updated_by')
  },
}
