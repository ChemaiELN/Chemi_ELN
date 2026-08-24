'use strict'

// New Equipment creation needs Maintenance Type (Internal/External) and a
// proper value+unit Maintenance Frequency, plus Last Maintenance Date exposed
// at create time (it was previously edit-only). The existing
// maintenance_frequency column was unused anywhere in the frontend, so it's
// repurposed as the unit half of the new value+unit pair rather than adding
// a third overlapping column.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.renameColumn('inv_equipment_catalogue', 'maintenance_frequency', 'maintenance_frequency_unit')
    await queryInterface.addColumn('inv_equipment_catalogue', 'maintenance_frequency_value', {
      type: Sequelize.INTEGER,
      allowNull: true,
    })
    await queryInterface.addColumn('inv_equipment_catalogue', 'maintenance_type', {
      type: Sequelize.STRING(10),
      allowNull: true,
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('inv_equipment_catalogue', 'maintenance_type')
    await queryInterface.removeColumn('inv_equipment_catalogue', 'maintenance_frequency_value')
    await queryInterface.renameColumn('inv_equipment_catalogue', 'maintenance_frequency_unit', 'maintenance_frequency')
  },
}
