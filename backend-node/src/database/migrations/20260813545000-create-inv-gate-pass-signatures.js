'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_gate_pass_signatures', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      gate_pass_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_gate_passes', key: 'id' },
        onDelete: 'CASCADE',
      },
      signing_for: { type: Sequelize.STRING(100), allowNull: false },
      name: { type: Sequelize.STRING(200), allowNull: false },
      comments: { type: Sequelize.TEXT, allowNull: true },
      completed_on: { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_gate_pass_signatures')
  },
}
