'use strict'

// Base shape before 20260817000001-master-data-items-audit.js adds
// created_by/updated_by/updated_at. Those apply on top of this base.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('master_data_items', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      category: { type: Sequelize.STRING(50), allowNull: false },
      code: { type: Sequelize.STRING(50), allowNull: false },
      name: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('master_data_items')
  },
}
