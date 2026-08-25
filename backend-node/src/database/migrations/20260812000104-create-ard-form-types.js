'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_form_types', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      code: { type: Sequelize.STRING, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      attribute_links: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      test_group_ids: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      mandate_certification: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      mandate_batch_no: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      mandate_sample_qty: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      mandate_qa_submission: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      updated_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: true },
      updated_at: { type: Sequelize.DATE, allowNull: true },
      category: { type: Sequelize.STRING, allowNull: true },
      allow_post_approval_changes: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_form_types')
  },
}
