'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_settings', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      setting_key: { type: Sequelize.STRING, allowNull: false, unique: true },
      setting_value: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
      setting_label: { type: Sequelize.STRING, allowNull: false, defaultValue: '' },
      setting_category: { type: Sequelize.STRING, allowNull: false, defaultValue: 'GENERAL' },
      description: { type: Sequelize.TEXT, allowNull: true },
      value_type: { type: Sequelize.STRING, allowNull: false, defaultValue: 'string' },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_settings')
  },
}
