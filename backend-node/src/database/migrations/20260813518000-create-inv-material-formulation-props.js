'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_material_formulation_props', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      material_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'inv_materials', key: 'id' },
        onDelete: 'CASCADE',
      },
      role: { type: Sequelize.STRING(100), allowNull: true },
      concentration: { type: Sequelize.DECIMAL(10, 4), allowNull: true },
      units: { type: Sequelize.STRING(50), allowNull: true },
      function: { type: Sequelize.STRING(200), allowNull: true },
      compatibility_notes: { type: Sequelize.TEXT, allowNull: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_material_formulation_props')
  },
}
