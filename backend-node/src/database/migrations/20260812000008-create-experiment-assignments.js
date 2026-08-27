'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('experiment_assignments', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      experiment_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'experiments', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      granted_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      granted_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('experiment_assignments')
  },
}
