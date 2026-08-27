'use strict'

// Pre-alter shape: source_batch_id/source_pack_id are added later by
// 20260817000000-add-stock-request-batch-link.js (they reference inv_batches
// and inv_batch_packs, which do not exist yet at this point in history).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_stock_requests', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      request_no: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      material_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_materials', key: 'id' },
      },
      qty_required: { type: Sequelize.DECIMAL(12, 4), allowNull: false },
      unit: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'g' },
      required_by_date: { type: Sequelize.DATEONLY, allowNull: true },
      criticality: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'GENERAL' },
      purpose: { type: Sequelize.TEXT, allowNull: true },
      requested_by: { type: Sequelize.STRING(200), allowNull: true },
      requested_at: { type: Sequelize.DATE, allowNull: true },
      department_code: { type: Sequelize.STRING(20), allowNull: true },
      approval_stage: { type: Sequelize.STRING(10), allowNull: true },
      approved_by: { type: Sequelize.STRING(200), allowNull: true },
      approved_at: { type: Sequelize.DATE, allowNull: true },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_stock_requests')
  },
}
