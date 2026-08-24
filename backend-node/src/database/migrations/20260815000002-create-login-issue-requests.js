'use strict'

// Queue of "I'm locked out / forgot password" requests a user can submit from
// the login page without authenticating, for an admin to action from the new
// Admin Dashboard's User Maintenance panel.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('login_issue_requests', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      username: { type: Sequelize.STRING(100), allowNull: false },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      issue_type: { type: Sequelize.STRING(20), allowNull: false }, // UNLOCK | PASSWORD_RESET
      description: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'PENDING' }, // PENDING | RESOLVED
      resolved_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      resolved_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    })

    await queryInterface.addIndex('login_issue_requests', ['status'], {
      name: 'login_issue_requests_status_idx',
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('login_issue_requests')
  },
}
