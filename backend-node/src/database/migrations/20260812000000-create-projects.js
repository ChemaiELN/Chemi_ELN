'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('projects', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      code: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      product_name: { type: Sequelize.STRING(255), allowNull: true },
      in_house_project_id: { type: Sequelize.STRING(100), allowNull: true },
      project_type: { type: Sequelize.STRING(50), allowNull: true },
      market: { type: Sequelize.STRING(50), allowNull: true },
      department_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'departments', key: 'id' },
      },
      manager_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      start_date: { type: Sequelize.DATEONLY, allowNull: true },
      target_date: { type: Sequelize.DATEONLY, allowNull: true },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ACTIVE' },
      description: { type: Sequelize.TEXT, allowNull: true },
      objective: { type: Sequelize.TEXT, allowNull: true },
      observation: { type: Sequelize.TEXT, allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      customer: { type: Sequelize.STRING(255), allowNull: true },
      adc_code: { type: Sequelize.STRING(100), allowNull: true },
      target_antigen: { type: Sequelize.STRING(255), allowNull: true },
      antibody_clone: { type: Sequelize.STRING(255), allowNull: true },
      payload: { type: Sequelize.STRING(255), allowNull: true },
      linker: { type: Sequelize.STRING(255), allowNull: true },
      target_dar: { type: Sequelize.STRING(50), allowNull: true },
      project_stage: { type: Sequelize.STRING(50), allowNull: true },
      qa_review_required: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
      oel_band: { type: Sequelize.STRING(100), allowNull: true },
      containment_category: { type: Sequelize.STRING(100), allowNull: true },
      gmp_non_gmp: { type: Sequelize.STRING(20), allowNull: true },
      regulatory_observations: { type: Sequelize.TEXT, allowNull: true },
      scheme_data: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })

    await queryInterface.createTable('project_code_counter', {
      year: { type: Sequelize.STRING(2), primaryKey: true, allowNull: false },
      last_seq: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 30000 },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('project_code_counter')
    await queryInterface.dropTable('projects')
  },
}
