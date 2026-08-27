'use strict'

// workbook_data (previous migration) carries the renderable spreadsheet, but
// nothing persisted the field/protection metadata convertXlsx() also computes
// from the source .xlsx — including which ranges the author locked via Excel
// sheet protection. Without it, every uploaded spreadsheet rendered fully
// editable regardless of what the author actually locked/unlocked in Excel.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ard_section_embedded_file', 'metadata', {
      type: Sequelize.JSONB,
      allowNull: true,
    })
    await queryInterface.addColumn('ard_template_section_embedded_file_snapshot', 'metadata', {
      type: Sequelize.JSONB,
      allowNull: true,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ard_section_embedded_file', 'metadata')
    await queryInterface.removeColumn('ard_template_section_embedded_file_snapshot', 'metadata')
  },
}
