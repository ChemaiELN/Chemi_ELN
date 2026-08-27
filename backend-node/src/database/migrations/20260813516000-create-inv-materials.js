'use strict'

// Includes inv_material_code_counter (trivial single-column counter table used
// by materials.routes.ts to generate material codes) alongside its parent.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_materials', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      material_type: { type: Sequelize.STRING(100), allowNull: true },
      cas_no: { type: Sequelize.STRING(100), allowNull: true },
      molecular_formula: { type: Sequelize.STRING(200), allowNull: true },
      mol_weight: { type: Sequelize.DECIMAL(12, 4), allowNull: true },
      storage_condition: { type: Sequelize.STRING(200), allowNull: true },
      hazard_class: { type: Sequelize.STRING(100), allowNull: true },
      iso_type: { type: Sequelize.STRING(50), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      department_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'departments', key: 'id' },
        onDelete: 'SET NULL',
      },
      consumable_type_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_consumable_types', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    })

    await queryInterface.createTable('inv_material_code_counter', {
      year: { type: Sequelize.STRING(2), primaryKey: true },
      last_seq: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 10000 },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_material_code_counter')
    await queryInterface.dropTable('inv_materials')
  },
}
