'use strict'

// Base pre-rearchitecture shape of ard_data_items, i.e. the shape as it stood
// before 20260819000001-create-ard-sections-rearchitecture.js (adds
// length_category/lov_lookup_category, migrates data_type values, drops
// options) and before 20260820000000/20260820000001 (rename
// lov_lookup_category -> lov_lookup_type, data normalization). Those
// migrations apply on top of this base in chronological order.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_data_items', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      name: { type: Sequelize.STRING, allowNull: false },
      data_type: { type: Sequelize.STRING, allowNull: true },
      options: { type: Sequelize.JSON, allowNull: true },
      uom: { type: Sequelize.STRING, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      updated_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: true },
      updated_at: { type: Sequelize.DATE, allowNull: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_data_items')
  },
}
