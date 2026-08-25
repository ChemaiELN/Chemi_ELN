'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('experiment_reviews', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      experiment_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'experiments', key: 'id' },
        onDelete: 'CASCADE',
      },
      reviewer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
      },
      assigned_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      assigned_at: { type: Sequelize.DATE },
      signed_at: { type: Sequelize.DATE, allowNull: true },
      sign_reason: { type: Sequelize.STRING(200), allowNull: true },
      decision: { type: Sequelize.STRING(20), allowNull: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('experiment_reviews')
  },
}
