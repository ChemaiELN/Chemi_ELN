'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'password_changed_at', { type: Sequelize.DATE, allowNull: true })
    // Existing accounts: treat the account's creation as the last password
    // change so password-expiry counts from a real date instead of null.
    await queryInterface.sequelize.query('UPDATE users SET password_changed_at = created_at WHERE password_changed_at IS NULL')
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'password_changed_at')
  },
}
