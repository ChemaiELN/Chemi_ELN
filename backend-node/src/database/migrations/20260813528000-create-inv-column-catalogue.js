'use strict'

// Pre-alter shape: serial_no/lot_no are the original fields here, later
// replaced by *_value/*_unit spec columns by
// 20260818020000-column-catalogue-specs.js.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_column_catalogue', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      column_id: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      column_type_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_column_types', key: 'id' },
        onDelete: 'SET NULL',
      },
      name: { type: Sequelize.STRING(255), allowNull: false },
      manufacturer: { type: Sequelize.STRING(255), allowNull: true },
      serial_no: { type: Sequelize.STRING(100), allowNull: true },
      lot_no: { type: Sequelize.STRING(100), allowNull: true },
      max_injections: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 500 },
      cumulative_injections: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ACTIVE' },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      department_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'departments', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_column_catalogue')
  },
}
