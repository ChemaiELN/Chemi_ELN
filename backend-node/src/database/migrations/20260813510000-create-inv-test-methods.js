'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_test_methods', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      test_name_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_test_names', key: 'id' },
        onDelete: 'CASCADE',
      },
      method_name: { type: Sequelize.STRING(255), allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_test_methods')
  },
}
