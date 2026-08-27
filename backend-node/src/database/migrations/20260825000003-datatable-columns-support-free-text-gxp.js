'use strict'

// Old's Lab Component sections (weighing, ph, sample_details, ...) used
// fixed, free-text GxP column presets (key + title, no Master Data link) —
// not the governed dataItemId-mapped columns the rearchitecture introduced
// for genuinely configurable Data Table sections. Both are legitimate: a
// "table"/"combined" section should stay tied to real Master Data items, but
// Lab Component sections need to support the old fixed key/title schema
// verbatim. This makes dataItemId optional and adds columnKey/columnLabel as
// the alternative, on both the live column table and its publish-time
// snapshot.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('ard_datatable_columns', 'data_item_id', {
      type: Sequelize.UUID,
      allowNull: true,
    })
    await queryInterface.addColumn('ard_datatable_columns', 'column_key', {
      type: Sequelize.STRING(100),
      allowNull: true,
    })
    await queryInterface.addColumn('ard_datatable_columns', 'column_label', {
      type: Sequelize.STRING(200),
      allowNull: true,
    })

    await queryInterface.changeColumn('ard_template_datatable_column_snapshot', 'data_item_id', {
      type: Sequelize.UUID,
      allowNull: true,
    })
    await queryInterface.addColumn('ard_template_datatable_column_snapshot', 'column_key', {
      type: Sequelize.STRING(100),
      allowNull: true,
    })
    await queryInterface.addColumn('ard_template_datatable_column_snapshot', 'column_label', {
      type: Sequelize.STRING(200),
      allowNull: true,
    })
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('ard_datatable_columns', 'column_key')
    await queryInterface.removeColumn('ard_datatable_columns', 'column_label')
    await queryInterface.changeColumn('ard_datatable_columns', 'data_item_id', {
      type: Sequelize.UUID,
      allowNull: false,
    })

    await queryInterface.removeColumn('ard_template_datatable_column_snapshot', 'column_key')
    await queryInterface.removeColumn('ard_template_datatable_column_snapshot', 'column_label')
    await queryInterface.changeColumn('ard_template_datatable_column_snapshot', 'data_item_id', {
      type: Sequelize.UUID,
      allowNull: false,
    })
  },
}
