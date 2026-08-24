'use strict'

// The Admin "Master Data" Sites tab (backed by this table) was found to have
// zero consumers anywhere else in the codebase — no FK column, no dropdown
// referencing it — unlike Measurement Master / Spare Parts / Test Master,
// which are all actively used elsewhere. Confirmed with the user before removal.
module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('sites')
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('sites', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      code: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(100), allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE },
    })
  },
}
