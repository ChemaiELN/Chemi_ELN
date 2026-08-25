'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_checklists', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      checklist_type: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'GENERAL' },
      log_type: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'CHECKLIST' },
      usage_type: { type: Sequelize.STRING(30), allowNull: true },
      target_kind: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'EQUIPMENT' },
      equipment_code: { type: Sequelize.STRING(100), allowNull: true },
      version: { type: Sequelize.STRING(10), allowNull: false, defaultValue: '0.1' },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'DRAFT' },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: Sequelize.STRING(200), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_checklists')
  },
}
