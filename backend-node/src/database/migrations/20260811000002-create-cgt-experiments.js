'use strict'

// Base shape from src/models/CgtProject.model.ts (CgtExperiment, CgtExperimentAssignment).
// No incremental migrations touch these tables yet.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('cgt_experiments', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      cgt_notebook_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'cgt_notebooks', key: 'id' },
      },
      cgt_project_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'cgt_projects', key: 'id' },
      },
      base_code: { type: Sequelize.STRING(50), allowNull: false },
      version: { type: Sequelize.SMALLINT, defaultValue: 1 },
      full_code: { type: Sequelize.STRING(60), allowNull: false, unique: true },
      title: { type: Sequelize.STRING(255), allowNull: false },
      screen_key: { type: Sequelize.STRING(100), allowNull: true },
      section_key: { type: Sequelize.STRING(100), allowNull: true },
      data: { type: Sequelize.JSONB, allowNull: true },
      observations: { type: Sequelize.TEXT, allowNull: true },
      conclusion: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING(20), defaultValue: 'DRAFT' },
      is_latest_version: { type: Sequelize.BOOLEAN, defaultValue: true },
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
      scientist_signed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      submitted_at: { type: Sequelize.DATE, allowNull: true },
      approved_at: { type: Sequelize.DATE, allowNull: true },
      rejected_at: { type: Sequelize.DATE, allowNull: true },
      rejection_reason: { type: Sequelize.TEXT, allowNull: true },
      scientist_signed_at: { type: Sequelize.DATE, allowNull: true },
      scientist_sign_reason: { type: Sequelize.STRING(500), allowNull: true },
      frozen_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })

    await queryInterface.createTable('cgt_experiment_assignments', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      cgt_experiment_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'cgt_experiments', key: 'id' },
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
      },
      granted_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      granted_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('cgt_experiment_assignments')
    await queryInterface.dropTable('cgt_experiments')
  },
}
