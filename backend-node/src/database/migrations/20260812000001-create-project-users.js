'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('project_users', {
      project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'projects', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      role: { type: Sequelize.STRING(50), allowNull: true },
      added_at: { type: Sequelize.DATE },
      added_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('project_users')
  },
}
