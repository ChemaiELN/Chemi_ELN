'use strict'

// Base pre-alter shape of ard_templates — before
// 20260818000003-add-ard-template-code.js adds `code`.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_templates', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      family_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'ard_templates', key: 'id' } },
      name: { type: Sequelize.STRING(200), allowNull: false },
      template_type: { type: Sequelize.STRING(50), allowNull: true },
      version: { type: Sequelize.INTEGER, defaultValue: 0 },
      status: { type: Sequelize.STRING(30), defaultValue: 'DRAFT' },
      description: { type: Sequelize.TEXT, allowNull: true },
      review_remarks: { type: Sequelize.TEXT, allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      approved_by: { type: Sequelize.STRING(200), allowNull: true },
      approved_on: { type: Sequelize.STRING(30), allowNull: true },
      created_by_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      sections: { type: Sequelize.JSONB, allowNull: true },
      dept_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'departments', key: 'id' } },
      activation_date: { type: Sequelize.STRING(20), allowNull: true },
      last_updated_by: { type: Sequelize.STRING(200), allowNull: true },
      last_updated_by_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      include_weighing: { type: Sequelize.BOOLEAN, defaultValue: false },
      include_ph: { type: Sequelize.BOOLEAN, defaultValue: false },
      include_chemicals: { type: Sequelize.BOOLEAN, defaultValue: false },
      include_sample_details: { type: Sequelize.BOOLEAN, defaultValue: false },
      include_equipment: { type: Sequelize.BOOLEAN, defaultValue: false },
      include_column: { type: Sequelize.BOOLEAN, defaultValue: false },
      include_attachments: { type: Sequelize.BOOLEAN, defaultValue: false },
      include_results: { type: Sequelize.BOOLEAN, defaultValue: false },
      include_conclusion: { type: Sequelize.BOOLEAN, defaultValue: false },
      include_cds_report: { type: Sequelize.BOOLEAN, defaultValue: false },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_templates')
  },
}
