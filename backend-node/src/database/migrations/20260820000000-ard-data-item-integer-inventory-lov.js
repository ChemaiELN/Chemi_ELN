'use strict'

// Product owner review against the legacy "Template DataItems" screen (2026-08-20):
// - dataType 'NUMBER' is renamed to 'INTEGER' to match the legacy label exactly
//   (Integer | Text | Date | LOV).
// - The LOV lookup source moves from the ARD-local master_data_items table to the
//   Inventory module's shared inv_general_lookup table (lookupType/lookupValue) —
//   this is what the legacy "Select LOV Lookup Type" field actually reads from.
//   The column is renamed lov_lookup_category -> lov_lookup_type to make that
//   source change unambiguous in the schema itself.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `UPDATE ard_data_items SET data_type = 'INTEGER' WHERE data_type = 'NUMBER'`,
    )
    await queryInterface.renameColumn('ard_data_items', 'lov_lookup_category', 'lov_lookup_type')
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.renameColumn('ard_data_items', 'lov_lookup_type', 'lov_lookup_category')
    await queryInterface.sequelize.query(
      `UPDATE ard_data_items SET data_type = 'NUMBER' WHERE data_type = 'INTEGER'`,
    )
  },
}
