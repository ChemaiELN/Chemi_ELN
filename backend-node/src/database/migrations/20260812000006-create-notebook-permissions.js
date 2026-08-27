'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notebook_permissions', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      notebook_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'notebooks', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      can_view: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
      can_edit: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
      can_submit: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
      can_verify: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
      can_approve: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
      can_clone: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
      can_export: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
      can_attach: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
      can_comment: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
      can_request_unlock: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
      can_deactivate: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
      granted_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      granted_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notebook_permissions')
  },
}
