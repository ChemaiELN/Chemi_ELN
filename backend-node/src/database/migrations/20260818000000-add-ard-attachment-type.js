'use strict'

// ARD attachments had no "type" concept at all — every attachment was just a
// bare file/link with no category. Adds an attachment_type column (e.g.
// Certificate/Report/Data/Others) plus a free-text custom_type_name used only
// when attachment_type is "Others".
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ard_attachments', 'attachment_type', {
      type: Sequelize.STRING(50),
      allowNull: true,
    })
    await queryInterface.addColumn('ard_attachments', 'custom_type_name', {
      type: Sequelize.STRING(100),
      allowNull: true,
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ard_attachments', 'attachment_type')
    await queryInterface.removeColumn('ard_attachments', 'custom_type_name')
  },
}
