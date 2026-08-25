'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('experiment_history', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      experiment_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'experiments', key: 'id' },
        onDelete: 'CASCADE',
      },
      actor_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      action: { type: Sequelize.STRING(50), allowNull: false },
      details: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('experiment_history')
  },
}
