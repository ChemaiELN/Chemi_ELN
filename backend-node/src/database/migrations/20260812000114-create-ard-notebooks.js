'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_notebooks', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      project_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'ard_projects', key: 'id' } },
      notebook_type: { type: Sequelize.STRING(50), allowNull: true },
      status: { type: Sequelize.STRING(20), defaultValue: 'OPEN' },
      assigned_users: { type: Sequelize.JSONB, allowNull: true },
      result_parameters: { type: Sequelize.JSONB, allowNull: true },
      audit_trail: { type: Sequelize.JSONB, allowNull: true },
      equipment_ids: { type: Sequelize.JSONB, allowNull: true },
      max_experiments: { type: Sequelize.INTEGER, allowNull: true },
      include_verification_flow: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_by: { type: Sequelize.STRING(200), allowNull: true },
      created_by_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_notebooks')
  },
}
