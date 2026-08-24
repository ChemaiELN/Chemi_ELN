'use strict'

// Equipment/Instrument already have a "location" field, but that's actually
// used for the Lab dropdown (see EquipmentPage.tsx) — this adds a genuinely
// separate Storage Location field, sourced from the same inv_storage_locations
// master used by Batches.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('inv_equipment_catalogue', 'storage_location_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'inv_storage_locations', key: 'id' },
      onDelete: 'SET NULL',
    })
    await queryInterface.addColumn('inv_instrument_catalogue', 'storage_location_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'inv_storage_locations', key: 'id' },
      onDelete: 'SET NULL',
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('inv_equipment_catalogue', 'storage_location_id')
    await queryInterface.removeColumn('inv_instrument_catalogue', 'storage_location_id')
  },
}
