'use strict'

// Lets a Gate Pass line item reference an Equipment/Instrument catalogue
// record instead of a Material — item_type discriminates which, and only the
// matching id column is populated. material_code/material_name stay generic
// display fields reused for the equipment/instrument's code/name too, so
// existing detail/print/challan views need no changes.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('inv_gate_pass_items', 'item_type', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'MATERIAL',
    })
    await queryInterface.addColumn('inv_gate_pass_items', 'equipment_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    })
    await queryInterface.addColumn('inv_gate_pass_items', 'instrument_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('inv_gate_pass_items', 'instrument_id')
    await queryInterface.removeColumn('inv_gate_pass_items', 'equipment_id')
    await queryInterface.removeColumn('inv_gate_pass_items', 'item_type')
  },
}
