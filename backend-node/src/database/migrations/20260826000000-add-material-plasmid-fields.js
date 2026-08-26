'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('inv_materials', 'antibiotic_resistance_marker', {
      type: Sequelize.STRING(200),
      allowNull: true,
    })
    await queryInterface.addColumn('inv_materials', 'stock_concentration', {
      type: Sequelize.STRING(100),
      allowNull: true,
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('inv_materials', 'antibiotic_resistance_marker')
    await queryInterface.removeColumn('inv_materials', 'stock_concentration')
  },
}
