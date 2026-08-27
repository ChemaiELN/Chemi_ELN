'use strict'

// Base shape from src/models/CgtProject.model.ts (CgtProject, CgtProjectCodeCounter).
// No incremental migrations touch cgt_projects / cgt_project_code_counter yet, so this
// reproduces the current model shape directly.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('cgt_projects', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      code: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      product_name: { type: Sequelize.STRING(255), allowNull: true },
      in_house_project_id: { type: Sequelize.STRING(100), allowNull: true },
      project_type: { type: Sequelize.STRING(50), allowNull: true },
      market: { type: Sequelize.STRING(50), allowNull: true },
      process: { type: Sequelize.STRING(50), allowNull: true },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      manager_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      start_date: { type: Sequelize.DATEONLY, allowNull: true },
      target_date: { type: Sequelize.DATEONLY, allowNull: true },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ACTIVE' },
      description: { type: Sequelize.TEXT, allowNull: true },
      objective: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })

    await queryInterface.createTable('cgt_project_code_counter', {
      year: { type: Sequelize.STRING(2), primaryKey: true, allowNull: false },
      last_seq: { type: Sequelize.INTEGER, defaultValue: 30000 },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('cgt_project_code_counter')
    await queryInterface.dropTable('cgt_projects')
  },
}
