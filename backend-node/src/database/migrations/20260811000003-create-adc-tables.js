'use strict'

// Base shape from src/models/AdcModels.model.ts (AdcObjective, AdcRegulatoryClassification,
// AdcRiskAssessment, AdcRiskItem). No incremental migrations touch these tables yet.
//
// `experiment_id` on adc_objective / adc_regulatory_classification / adc_risk_assessment is
// a UUID with no explicit FK in the model — it is not declared as an association to a
// specific "experiments" table in models/index.ts (ADC objects can hang off either the
// legacy `experiments` table or `cgt_experiments`, depending on module), so no `references`
// is added here to avoid an incorrect/overly-narrow constraint.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('adc_objective', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      experiment_id: { type: Sequelize.UUID, allowNull: false, unique: true },
      study_purpose: { type: Sequelize.TEXT, allowNull: true },
      hypothesis: { type: Sequelize.TEXT, allowNull: true },
      success_criteria: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })

    await queryInterface.createTable('adc_regulatory_classification', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      experiment_id: { type: Sequelize.UUID, allowNull: false, unique: true },
      oel_band: { type: Sequelize.STRING(50), allowNull: true },
      containment_category: { type: Sequelize.STRING(100), allowNull: true },
      gmp_classification: { type: Sequelize.STRING(50), allowNull: true },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })

    await queryInterface.createTable('adc_risk_assessment', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      experiment_id: { type: Sequelize.UUID, allowNull: false, unique: true },
      assessment_id: { type: Sequelize.STRING(100), allowNull: true },
      assessment_type: { type: Sequelize.STRING(50), allowNull: true },
      last_reviewed: { type: Sequelize.DATEONLY, allowNull: true },
      reviewed_by: { type: Sequelize.STRING(200), allowNull: true },
      overall_risk_level: { type: Sequelize.STRING(20), allowNull: true },
      status: { type: Sequelize.STRING(30), defaultValue: 'Draft' },
      additional_notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })

    await queryInterface.createTable('adc_risk_item', {
      id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, autoIncrement: true },
      risk_assessment_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'adc_risk_assessment', key: 'id' },
      },
      seq_no: { type: Sequelize.SMALLINT, defaultValue: 0 },
      process_step: { type: Sequelize.STRING(300), allowNull: true },
      failure_mode: { type: Sequelize.STRING(300), allowNull: true },
      severity: { type: Sequelize.SMALLINT, allowNull: true },
      occurrence: { type: Sequelize.SMALLINT, allowNull: true },
      detection: { type: Sequelize.SMALLINT, allowNull: true },
      rpn: { type: Sequelize.INTEGER, allowNull: true },
      mitigation: { type: Sequelize.TEXT, allowNull: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('adc_risk_item')
    await queryInterface.dropTable('adc_risk_assessment')
    await queryInterface.dropTable('adc_regulatory_classification')
    await queryInterface.dropTable('adc_objective')
  },
}
