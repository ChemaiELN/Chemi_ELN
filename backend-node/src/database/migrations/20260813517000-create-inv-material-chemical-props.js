'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_material_chemical_props', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      material_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'inv_materials', key: 'id' },
        onDelete: 'CASCADE',
      },
      purity_pct: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
      grade: { type: Sequelize.STRING(100), allowNull: true },
      appearance: { type: Sequelize.STRING(200), allowNull: true },
      solubility: { type: Sequelize.STRING(200), allowNull: true },
      boiling_pt: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
      melting_pt: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
      flash_pt: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
      density: { type: Sequelize.DECIMAL(8, 4), allowNull: true },
      ph_range: { type: Sequelize.STRING(50), allowNull: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_material_chemical_props')
  },
}
