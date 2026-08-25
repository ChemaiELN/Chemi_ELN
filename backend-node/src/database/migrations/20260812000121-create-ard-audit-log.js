'use strict'

// entity_id is a polymorphic reference (entity_type names the owning table),
// so it intentionally carries no FK constraint.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_audit_log', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      entity_type: { type: Sequelize.STRING(50), allowNull: false },
      entity_id: { type: Sequelize.UUID, allowNull: true },
      action: { type: Sequelize.STRING(100), allowNull: false },
      detail: { type: Sequelize.TEXT, allowNull: true },
      user_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_audit_log')
  },
}
