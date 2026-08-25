'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_qualification_alerts', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      name: { type: Sequelize.STRING, allowNull: false },
      days_before_expiry: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 30 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_qualification_alerts')
  },
}
