'use strict'

// Base shape from src/models/CgtProject.model.ts (CgtNotebook, CgtNotebookPermission).
// No incremental migrations touch these tables yet.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('cgt_notebooks', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      title: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.STRING(1000), allowNull: true },
      cgt_project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'cgt_projects', key: 'id' },
      },
      template_id: { type: Sequelize.UUID, allowNull: true },
      template_snapshot: { type: Sequelize.JSONB, allowNull: true },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      status: { type: Sequelize.STRING(20), defaultValue: 'ACTIVE' },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })

    await queryInterface.createTable('cgt_notebook_permissions', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      cgt_notebook_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'cgt_notebooks', key: 'id' },
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
      },
      can_view: { type: Sequelize.BOOLEAN, defaultValue: true },
      can_edit: { type: Sequelize.BOOLEAN, defaultValue: false },
      can_submit: { type: Sequelize.BOOLEAN, defaultValue: false },
      granted_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      granted_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('cgt_notebook_permissions')
    await queryInterface.dropTable('cgt_notebooks')
  },
}
