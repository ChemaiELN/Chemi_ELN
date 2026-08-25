'use strict'

// Schema as it stood before 20260814000000-add-user-profile-fields.js (profile
// columns), 20260814000001-relax-user-not-null-constraints.js (emp_no/email/
// role_id nullability), 20260814000002-drop-user-site.js (drops `site`), and
// 20260820000000-add-user-password-changed-at.js. Those migrations apply on
// top of this base in chronological order.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      username: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      emp_no: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      role_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'roles', key: 'id' },
      },
      department_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'departments', key: 'id' },
      },
      lab_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'labs', key: 'id' },
      },
      site: { type: Sequelize.STRING(100), allowNull: true },
      failed_login_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      locked_until: { type: Sequelize.DATE, allowNull: true },
      token_version: { type: Sequelize.INTEGER, defaultValue: 1 },
      must_reset_password: { type: Sequelize.BOOLEAN, defaultValue: false },
      allow_settings_update: { type: Sequelize.BOOLEAN, defaultValue: false },
      dashboard_reference: { type: Sequelize.STRING(255), allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users')
  },
}
