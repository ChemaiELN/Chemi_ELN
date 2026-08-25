'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_content_blocks', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      name: { type: Sequelize.STRING, allowNull: false },
      content_type: { type: Sequelize.STRING, allowNull: true },
      body: { type: Sequelize.TEXT, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      display_height: { type: Sequelize.INTEGER, allowNull: true },
      created_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      updated_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: true },
      updated_at: { type: Sequelize.DATE, allowNull: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_content_blocks')
  },
}
