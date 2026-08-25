'use strict'

// Base pre-alter shape of ard_projects — before
// 20260818000001-add-ard-project-updated-by.js adds `updated_by`.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_projects', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(200), allowNull: false },
      product_name: { type: Sequelize.STRING(200), allowNull: true },
      product_code: { type: Sequelize.STRING(50), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      customer: { type: Sequelize.STRING(200), allowNull: true },
      project_type: { type: Sequelize.STRING(50), allowNull: true },
      analysis_type: { type: Sequelize.STRING(30), allowNull: true },
      priority: { type: Sequelize.STRING(20), allowNull: true },
      target_date: { type: Sequelize.STRING(20), allowNull: true },
      status: { type: Sequelize.STRING(20), defaultValue: 'OPEN' },
      owner_name: { type: Sequelize.STRING(200), allowNull: true },
      owner_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      stp_documents: { type: Sequelize.JSONB, allowNull: true },
      team: { type: Sequelize.JSONB, allowNull: true },
      attributes: { type: Sequelize.JSONB, allowNull: true },
      audit_trail: { type: Sequelize.JSONB, allowNull: true },
      created_by: { type: Sequelize.STRING(200), allowNull: true },
      created_by_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_projects')
  },
}
