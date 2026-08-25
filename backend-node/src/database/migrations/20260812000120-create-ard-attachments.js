'use strict'

// Base pre-alter shape of ard_attachments — before
// 20260818000000-add-ard-attachment-type.js adds attachment_type/custom_type_name,
// and before 20260824000001-ard-attachment-link-nullable.js relaxes
// attachment_link to nullable. entity_id is a polymorphic reference (entity_type
// names the owning table), so it intentionally carries no FK constraint.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_attachments', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      entity_type: { type: Sequelize.STRING(50), allowNull: false },
      entity_id: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING(300), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      filename: { type: Sequelize.STRING(300), allowNull: true },
      file_type: { type: Sequelize.STRING(100), allowNull: true },
      size_bytes: { type: Sequelize.INTEGER, allowNull: true },
      attachment_link: { type: Sequelize.TEXT, allowNull: false },
      uploaded_by: { type: Sequelize.STRING(200), allowNull: true },
      uploaded_by_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_attachments')
  },
}
