'use strict'

// ard_attachments.attachment_link was NOT NULL, but a real file upload (the
// normal case) has no link — only the separate "folder link" (UNC path, no
// file) feature populates it. The model already declared this column
// nullable; the actual DB constraint never matched, so every file upload
// failed with "null value in column attachment_link violates not-null
// constraint".
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('ard_attachments', 'attachment_link', {
      type: Sequelize.TEXT,
      allowNull: true,
    })
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('ard_attachments', 'attachment_link', {
      type: Sequelize.TEXT,
      allowNull: false,
    })
  },
}
