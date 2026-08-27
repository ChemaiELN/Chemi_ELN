'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('project_risk_assessments', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'projects', key: 'id' },
        onDelete: 'CASCADE',
      },
      assessment_id: { type: Sequelize.STRING, allowNull: true },
      assessment_type: { type: Sequelize.STRING, allowNull: true },
      last_reviewed: { type: Sequelize.DATE, allowNull: true },
      reviewed_by: { type: Sequelize.STRING(200), allowNull: true },
      overall_risk_level: { type: Sequelize.STRING(20), allowNull: true },
      status: { type: Sequelize.STRING(30), allowNull: true },
      additional_notes: { type: Sequelize.TEXT, allowNull: true },
      observations: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })

    await queryInterface.createTable('project_risk_rows', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      assessment_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'project_risk_assessments', key: 'id' },
        onDelete: 'CASCADE',
      },
      sort_order: { type: Sequelize.INTEGER, allowNull: true },
      process_step: { type: Sequelize.TEXT, allowNull: true },
      failure_mode: { type: Sequelize.TEXT, allowNull: true },
      severity: { type: Sequelize.SMALLINT, allowNull: true },
      occurrence: { type: Sequelize.SMALLINT, allowNull: true },
      detection: { type: Sequelize.SMALLINT, allowNull: true },
      mitigation: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('project_risk_rows')
    await queryInterface.dropTable('project_risk_assessments')
  },
}
