'use strict'

// A `preconfigured_excel` section stores the uploaded .xlsx's raw bytes
// (file_data) but nothing ever converted them into Univer's renderable
// workbook JSON — Preview Mode and the real experiment page could only ever
// show the filename as text, never the actual spreadsheet. workbook_data
// mirrors what STP Procedure already does (see ProjectStp.procedureSpreadsheet)
// — populated at upload time via the same convertXlsx() utility.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ard_section_embedded_file', 'workbook_data', {
      type: Sequelize.JSONB,
      allowNull: true,
    })
    await queryInterface.addColumn('ard_template_section_embedded_file_snapshot', 'workbook_data', {
      type: Sequelize.JSONB,
      allowNull: true,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ard_section_embedded_file', 'workbook_data')
    await queryInterface.removeColumn('ard_template_section_embedded_file_snapshot', 'workbook_data')
  },
}
