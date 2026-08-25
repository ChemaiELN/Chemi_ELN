'use strict'

// Base pre-alter shape of ard_project_specifications — before
// 20260818000002-add-ard-spec-updated-by.js adds `updated_by`, and before
// 20260819000000-add-ard-spec-type-desc-shortname.js adds
// spec_type/short_name/description.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_project_specifications', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      project_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_projects', key: 'id' } },
      spec_code: { type: Sequelize.STRING(50), allowNull: false },
      version: { type: Sequelize.STRING(20), defaultValue: '1.0' },
      title: { type: Sequelize.STRING(200), allowNull: false },
      status: { type: Sequelize.STRING(30), defaultValue: 'DRAFT' },
      test_parameters: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      created_by: { type: Sequelize.STRING(200), allowNull: false },
      created_by_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      approved_by: { type: Sequelize.STRING(200), allowNull: true },
      approved_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE, allowNull: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_project_specifications')
  },
}
