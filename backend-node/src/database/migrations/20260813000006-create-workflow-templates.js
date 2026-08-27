'use strict'

// Base shape before 20260821000000-add-workflow-template-show-in-dropdown.js
// adds show_in_notebook_dropdown. That migration applies on top of this base.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('workflow_templates', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      name: { type: Sequelize.STRING(255), allowNull: false },
      slug: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      category: { type: Sequelize.STRING(100), allowNull: true },
      version: { type: Sequelize.INTEGER, defaultValue: 1 },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      definition: { type: Sequelize.JSONB, allowNull: true },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('workflow_templates')
  },
}
