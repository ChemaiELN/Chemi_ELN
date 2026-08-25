'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('experiments', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      notebook_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'notebooks', key: 'id' },
        onDelete: 'CASCADE',
      },
      project_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'projects', key: 'id' },
      },
      base_code: { type: Sequelize.STRING(50), allowNull: false },
      version: { type: Sequelize.SMALLINT, allowNull: true, defaultValue: 1 },
      full_code: { type: Sequelize.STRING(60), allowNull: false, unique: true },
      title: { type: Sequelize.STRING(255), allowNull: false },
      screen_key: { type: Sequelize.STRING(100), allowNull: true },
      section_key: { type: Sequelize.STRING(100), allowNull: true },
      data: { type: Sequelize.JSONB, allowNull: true },
      observations: { type: Sequelize.TEXT, allowNull: true },
      conclusion: { type: Sequelize.TEXT, allowNull: true },
      disposition: { type: Sequelize.STRING(100), allowNull: true },
      lp_disposition: { type: Sequelize.STRING(100), allowNull: true },
      scheme_mol: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING(20), allowNull: true, defaultValue: 'DRAFT' },
      is_latest_version: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
      parent_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'experiments', key: 'id' },
      },
      linked_preliminary_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'experiments', key: 'id' },
      },
      revision_note: { type: Sequelize.TEXT, allowNull: true },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      submitted_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      approved_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      rejected_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      voided_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      scientist_signed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      submitted_at: { type: Sequelize.DATE, allowNull: true },
      approved_at: { type: Sequelize.DATE, allowNull: true },
      rejected_at: { type: Sequelize.DATE, allowNull: true },
      voided_at: { type: Sequelize.DATE, allowNull: true },
      scientist_signed_at: { type: Sequelize.DATE, allowNull: true },
      rejection_reason: { type: Sequelize.TEXT, allowNull: true },
      void_reason: { type: Sequelize.TEXT, allowNull: true },
      scientist_sign_reason: { type: Sequelize.STRING(200), allowNull: true },
      frozen_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('experiments')
  },
}
