'use strict'

// Audit trail for the Administration module (Users, Departments, Roles,
// Labs, Department Users, Department Role Privileges, Settings, ID
// Numbering, Master Data). Mirrors inv_audit_trail's shape so the same kind
// of read/filter UI (event type / entity type / performed by / date range)
// works the same way here.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('admin_audit_trail', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      event_type: { type: Sequelize.STRING(50), allowNull: false },
      entity_type: { type: Sequelize.STRING(50), allowNull: false },
      entity_id: { type: Sequelize.STRING(100), allowNull: true },
      entity_ref: { type: Sequelize.STRING(200), allowNull: true },
      performed_by: { type: Sequelize.STRING(200), allowNull: false },
      performed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      old_value: { type: Sequelize.TEXT, allowNull: true },
      new_value: { type: Sequelize.TEXT, allowNull: true },
      details: { type: Sequelize.TEXT, allowNull: true },
    })

    await queryInterface.addIndex('admin_audit_trail', ['entity_type', 'entity_id'], {
      name: 'admin_audit_trail_entity_idx',
    })
    await queryInterface.addIndex('admin_audit_trail', ['performed_at'], {
      name: 'admin_audit_trail_performed_at_idx',
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('admin_audit_trail')
  },
}
