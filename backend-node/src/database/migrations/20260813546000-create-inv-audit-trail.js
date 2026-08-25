'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_audit_trail', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      event_type: { type: Sequelize.STRING(50), allowNull: false },
      entity_type: { type: Sequelize.STRING(50), allowNull: false },
      entity_id: { type: Sequelize.STRING(100), allowNull: true },
      entity_ref: { type: Sequelize.STRING(200), allowNull: true },
      performed_by: { type: Sequelize.STRING(200), allowNull: false },
      performed_at: { type: Sequelize.DATE, allowNull: false },
      old_value: { type: Sequelize.TEXT, allowNull: true },
      new_value: { type: Sequelize.TEXT, allowNull: true },
      details: { type: Sequelize.TEXT, allowNull: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_audit_trail')
  },
}
