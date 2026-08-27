'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_test_names', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      test_type_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_test_types', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING(255), allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_test_names')
  },
}
