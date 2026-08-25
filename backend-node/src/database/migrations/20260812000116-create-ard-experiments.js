'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_experiments', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      template_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'ard_templates', key: 'id' } },
      template_name: { type: Sequelize.STRING(200), allowNull: true },
      status: { type: Sequelize.STRING(30), defaultValue: 'IN_PROGRESS' },
      version: { type: Sequelize.INTEGER, defaultValue: 1 },
      section_defs: { type: Sequelize.JSONB, allowNull: true },
      sections: { type: Sequelize.JSONB, allowNull: true },
      history: { type: Sequelize.JSONB, allowNull: true },
      linked_samples: { type: Sequelize.JSONB, allowNull: true },
      reference_experiments: { type: Sequelize.JSONB, allowNull: true },
      clarifications: { type: Sequelize.JSONB, allowNull: true },
      section_comments: { type: Sequelize.JSONB, allowNull: true },
      post_analytical: { type: Sequelize.JSONB, allowNull: true },
      notebook_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'ard_notebooks', key: 'id' } },
      project_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'ard_projects', key: 'id' } },
      project_stp_id: { type: Sequelize.STRING(100), allowNull: true },
      test_type: { type: Sequelize.STRING(100), allowNull: true },
      test_subtype: { type: Sequelize.STRING(100), allowNull: true },
      atr_result_id: { type: Sequelize.UUID, allowNull: true },
      version_snapshots: { type: Sequelize.JSONB, allowNull: true },
      highlighted: { type: Sequelize.BOOLEAN, defaultValue: false },
      reviewer_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      reviewer_name: { type: Sequelize.STRING(200), allowNull: true },
      aim_achieved: { type: Sequelize.BOOLEAN, allowNull: true },
      aim_remarks: { type: Sequelize.TEXT, allowNull: true },
      contributors: { type: Sequelize.JSONB, allowNull: true },
      linked_atr_ids: { type: Sequelize.JSONB, allowNull: true },
      editor_lock_user_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      editor_lock_username: { type: Sequelize.STRING(200), allowNull: true },
      editor_lock_expires_at: { type: Sequelize.DATE, allowNull: true },
      created_by_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      submitted_by_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      approved_by_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      submitted_at: { type: Sequelize.DATE, allowNull: true },
      approved_at: { type: Sequelize.DATE, allowNull: true },
      printed_at: { type: Sequelize.DATE, allowNull: true },
      printed_by: { type: Sequelize.STRING(200), allowNull: true },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_experiments')
  },
}
