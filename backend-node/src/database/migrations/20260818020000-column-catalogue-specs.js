'use strict'

// Column instances (inv_column_catalogue) never used serial_no/lot_no in
// practice — chromatography columns are identified by physical specs instead.
// Replace those two fields with the actual spec fields (each a value + a UOM
// unit symbol, so the unit dropdown can be sourced from the existing UOM
// Master instead of being hardcoded).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('inv_column_catalogue', 'serial_no')
    await queryInterface.removeColumn('inv_column_catalogue', 'lot_no')

    const specFields = [
      'length', 'pore_size', 'inner_diameter', 'particle_size', 'film_thickness', 'outer_diameter',
    ]
    for (const field of specFields) {
      await queryInterface.addColumn('inv_column_catalogue', `${field}_value`, {
        type: Sequelize.DECIMAL(12, 4),
        allowNull: true,
      })
      await queryInterface.addColumn('inv_column_catalogue', `${field}_unit`, {
        type: Sequelize.STRING(20),
        allowNull: true,
      })
    }

    // Pore size is conventionally measured in Ångströms, which the "length"
    // UOM dimension didn't have a unit for yet.
    const [[lengthDim]] = await queryInterface.sequelize.query(
      `SELECT id FROM inv_uom_dimensions WHERE dimension_key = 'length'`,
    )
    if (lengthDim) {
      const [[existing]] = await queryInterface.sequelize.query(
        `SELECT id FROM inv_uom_units WHERE dimension_id = :dimId AND symbol = 'Å'`,
        { replacements: { dimId: lengthDim.id } },
      )
      if (!existing) {
        await queryInterface.sequelize.query(
          `INSERT INTO inv_uom_units (dimension_id, symbol, name, factor_to_base, sort_order, is_active)
           VALUES (:dimId, 'Å', 'Angstrom', 0.0000000001, 5, true)`,
          { replacements: { dimId: lengthDim.id } },
        )
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const specFields = [
      'length', 'pore_size', 'inner_diameter', 'particle_size', 'film_thickness', 'outer_diameter',
    ]
    for (const field of specFields) {
      await queryInterface.removeColumn('inv_column_catalogue', `${field}_value`)
      await queryInterface.removeColumn('inv_column_catalogue', `${field}_unit`)
    }

    await queryInterface.addColumn('inv_column_catalogue', 'serial_no', {
      type: Sequelize.STRING(100),
      allowNull: true,
    })
    await queryInterface.addColumn('inv_column_catalogue', 'lot_no', {
      type: Sequelize.STRING(100),
      allowNull: true,
    })
  },
}
