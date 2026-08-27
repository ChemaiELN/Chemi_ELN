'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('workflow_template_versions', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      template_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'workflow_templates', key: 'id' },
        onDelete: 'CASCADE',
      },
      version: { type: Sequelize.INTEGER, allowNull: false },
      definition: { type: Sequelize.JSONB, allowNull: true },
      saved_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      saved_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('workflow_template_versions')
  },
}
