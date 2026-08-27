'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('routes', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
        onDelete: 'CASCADE',
      },
      code: { type: Sequelize.STRING(10), allowNull: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.STRING(500), allowNull: true },
      sort_order: { type: Sequelize.SMALLINT, allowNull: true },
      status: { type: Sequelize.STRING(20), allowNull: true },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('routes')
  },
}
