'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('global_settings', {
      id: { type: Sequelize.INTEGER, primaryKey: true, defaultValue: 1 },
      auth_type: { type: Sequelize.STRING(50), allowNull: true },
      lock_user_after_x_attempts: { type: Sequelize.INTEGER, defaultValue: 5 },
      password_expiry_days: { type: Sequelize.INTEGER, defaultValue: 90 },
      max_image_kb: { type: Sequelize.INTEGER, defaultValue: 2048 },
      max_attachment_kb: { type: Sequelize.INTEGER, defaultValue: 51200 },
      experiments_per_notebook: { type: Sequelize.INTEGER, defaultValue: 999 },
      notebooks_per_project: { type: Sequelize.INTEGER, defaultValue: 999 },
      search_limit: { type: Sequelize.INTEGER, defaultValue: 100 },
      qa_role: { type: Sequelize.STRING(20), allowNull: true },
      smtp_host: { type: Sequelize.STRING(255), allowNull: true },
      smtp_port: { type: Sequelize.INTEGER, allowNull: true },
      smtp_from_address: { type: Sequelize.STRING(255), allowNull: true },
      smtp_username: { type: Sequelize.STRING(255), allowNull: true },
      smtp_password: { type: Sequelize.STRING(255), allowNull: true },
      enable_email_notifications: { type: Sequelize.BOOLEAN, defaultValue: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('global_settings')
  },
}
