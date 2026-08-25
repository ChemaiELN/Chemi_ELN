'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_test_group_members', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      test_group_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_test_groups', key: 'id' } },
      test_configuration_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_test_configurations', key: 'id' } },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_test_group_members')
  },
}
