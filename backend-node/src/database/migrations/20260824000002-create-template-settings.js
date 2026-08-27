'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('template_dropdown_selections', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
      },
      scope: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      process_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'cgt_processes', key: 'id' },
        onDelete: 'CASCADE',
      },
      template_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'workflow_templates', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    })

    await queryInterface.addIndex('template_dropdown_selections', ['scope', 'process_id', 'template_id'], {
      unique: true,
      name: 'template_dropdown_selections_unique',
    })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('template_dropdown_selections')
  },
}
