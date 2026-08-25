'use strict'

// Pre-alter shape: storage_location_id is added later by
// 20260818030000-add-storage-location-to-catalogues.js. maintenance_frequency
// is later renamed to maintenance_frequency_unit, and maintenance_frequency_value
// / maintenance_type are added, by 20260818040000-equipment-maintenance-fields.js.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_equipment_catalogue', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      asset_id: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      equipment_type_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_equipment_types', key: 'id' },
        onDelete: 'SET NULL',
      },
      name: { type: Sequelize.STRING(255), allowNull: false },
      make: { type: Sequelize.STRING(100), allowNull: true },
      model: { type: Sequelize.STRING(100), allowNull: true },
      serial_no: { type: Sequelize.STRING(100), allowNull: true },
      location: { type: Sequelize.STRING(200), allowNull: true },
      usage_type: { type: Sequelize.STRING(50), allowNull: true },
      movable: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      gross_capacity: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      capacity_unit: { type: Sequelize.STRING(50), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      maintenance_status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'OK' },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'AVAILABLE' },
      last_maintenance_date: { type: Sequelize.DATEONLY, allowNull: true },
      next_maintenance_date: { type: Sequelize.DATEONLY, allowNull: true },
      maintenance_frequency: { type: Sequelize.STRING(20), allowNull: true },
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
    await queryInterface.dropTable('inv_equipment_catalogue')
  },
}
