'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_atr_samples', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      atr_form_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_atr_forms', key: 'id' } },
      sample_code: { type: Sequelize.STRING, allowNull: false },
      sample_type: { type: Sequelize.STRING, allowNull: true },
      quantity: { type: Sequelize.STRING, allowNull: true },
      uom: { type: Sequelize.STRING, allowNull: true },
      pack_type: { type: Sequelize.STRING, allowNull: true },
      storage_condition: { type: Sequelize.STRING, allowNull: true },
      batch_no: { type: Sequelize.STRING, allowNull: true },
      mfg_date: { type: Sequelize.STRING, allowNull: true },
      exp_date: { type: Sequelize.STRING, allowNull: true },
      sample_description: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'ACTIVE' },
      chemicals: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      manufactured_by: { type: Sequelize.STRING, allowNull: true },
      received_by: { type: Sequelize.STRING, allowNull: true },
      prepared_by: { type: Sequelize.STRING, allowNull: true },
      sampled_by: { type: Sequelize.STRING, allowNull: true },
      received_on: { type: Sequelize.STRING, allowNull: true },
      prepared_on: { type: Sequelize.STRING, allowNull: true },
      sampled_on: { type: Sequelize.STRING, allowNull: true },
      total_containers: { type: Sequelize.INTEGER, allowNull: true },
      sampled_containers: { type: Sequelize.INTEGER, allowNull: true },
      sample_content: { type: Sequelize.TEXT, allowNull: true },
      sample_integrity: { type: Sequelize.STRING, allowNull: true },
      additional_remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: true },
      updated_at: { type: Sequelize.DATE, allowNull: true },
      internal_sample_no: { type: Sequelize.STRING, allowNull: true },
      product_name: { type: Sequelize.STRING, allowNull: true },
      source_batch_id: { type: Sequelize.INTEGER, allowNull: true },
      hazard_warning_flag: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      control_qty: { type: Sequelize.STRING, allowNull: true },
      control_qty_uom: { type: Sequelize.STRING, allowNull: true },
      sample_iteration: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 1 },
      ar_no: { type: Sequelize.STRING, allowNull: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_atr_samples')
  },
}
