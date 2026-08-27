'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_teams', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      name: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      hod_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      tl_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      tl_ids: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      member_ids: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      tl_analyst_map: { type: Sequelize.JSONB, allowNull: true },
      tl_analyst_can_review: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      created_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_teams')
  },
}
