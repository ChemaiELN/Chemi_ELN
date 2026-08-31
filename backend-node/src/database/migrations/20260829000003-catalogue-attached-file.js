'use strict'

// Generic single-file attachment for Equipment, Instrument and Column
// catalogue records, mirroring the Manufacturer "Qualification Document"
// pattern (see 20260825001016-seed-inv-manufacturers.js / manufacturers.routes.ts).
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const table of ['inv_equipment_catalogue', 'inv_instrument_catalogue', 'inv_column_catalogue']) {
      await queryInterface.addColumn(table, 'attached_file_path', {
        type: Sequelize.STRING(500),
        allowNull: true,
      })
    }
  },

  async down(queryInterface) {
    for (const table of ['inv_equipment_catalogue', 'inv_instrument_catalogue', 'inv_column_catalogue']) {
      await queryInterface.removeColumn(table, 'attached_file_path')
    }
  },
}
