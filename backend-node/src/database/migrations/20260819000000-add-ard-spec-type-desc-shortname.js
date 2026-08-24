'use strict'
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ard_project_specifications', 'spec_type', {
      type: Sequelize.STRING(60),
      allowNull: true,
    })
    await queryInterface.addColumn('ard_project_specifications', 'short_name', {
      type: Sequelize.STRING(60),
      allowNull: true,
    })
    await queryInterface.addColumn('ard_project_specifications', 'description', {
      type: Sequelize.TEXT,
      allowNull: true,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ard_project_specifications', 'spec_type')
    await queryInterface.removeColumn('ard_project_specifications', 'short_name')
    await queryInterface.removeColumn('ard_project_specifications', 'description')
  },
}
