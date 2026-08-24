'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('workflow_templates', 'show_in_notebook_dropdown', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('workflow_templates', 'show_in_notebook_dropdown')
  },
}
