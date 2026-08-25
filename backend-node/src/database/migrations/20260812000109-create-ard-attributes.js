'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_attributes', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      name: { type: Sequelize.STRING, allowNull: false },
      label: { type: Sequelize.STRING, allowNull: true },
      field_type: { type: Sequelize.STRING, allowNull: true },
      required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      max_length: { type: Sequelize.INTEGER, allowNull: true },
      options: { type: Sequelize.JSON, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      updated_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: true },
      updated_at: { type: Sequelize.DATE, allowNull: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_attributes')
  },
}
