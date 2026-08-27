'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_checklist_approvals', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      checklist_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_checklists', key: 'id' },
        onDelete: 'CASCADE',
      },
      action: { type: Sequelize.STRING(20), allowNull: false },
      from_state: { type: Sequelize.STRING(30), allowNull: true },
      to_state: { type: Sequelize.STRING(30), allowNull: true },
      performed_by: { type: Sequelize.STRING(200), allowNull: false },
      comment: { type: Sequelize.TEXT, allowNull: true },
      performed_at: { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_checklist_approvals')
  },
}
