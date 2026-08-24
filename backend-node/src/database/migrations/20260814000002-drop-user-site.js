'use strict'

// Site was a free-text field on users; department/role assignment (managed via
// the Department Users screen) replaces its purpose. Not to be confused with
// the separate `sites` master-data table (facility site codes), left untouched.
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('users', 'site')
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'site', { type: Sequelize.STRING(100), allowNull: true })
  },
}
