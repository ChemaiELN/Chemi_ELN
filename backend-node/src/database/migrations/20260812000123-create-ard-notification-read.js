'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_notification_read', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
      notification_id: { type: Sequelize.STRING(100), allowNull: false },
      created_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_notification_read')
  },
}
