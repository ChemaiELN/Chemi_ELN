'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_batches', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      batch_no: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      material_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_materials', key: 'id' },
      },
      manufacturer_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_manufacturers', key: 'id' },
        onDelete: 'SET NULL',
      },
      stock_request_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_stock_requests', key: 'id' },
        onDelete: 'SET NULL',
      },
      qty_received: { type: Sequelize.DECIMAL(12, 4), allowNull: false },
      qty_available: { type: Sequelize.DECIMAL(12, 4), allowNull: false },
      unit: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'g' },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'AVAILABLE' },
      category: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'available' },
      measuring_unit: { type: Sequelize.STRING(50), allowNull: true },
      measuring_unit_value: { type: Sequelize.DECIMAL(12, 4), allowNull: true },
      include_pack: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      pack_number: { type: Sequelize.INTEGER, allowNull: true },
      pack_type: { type: Sequelize.STRING(100), allowNull: true },
      pack_mode: { type: Sequelize.STRING(20), allowNull: true },
      inhouse_batch_no: { type: Sequelize.STRING(100), allowNull: true },
      mfg_date: { type: Sequelize.DATEONLY, allowNull: true },
      expiry_date: { type: Sequelize.DATEONLY, allowNull: true },
      retest_date: { type: Sequelize.DATEONLY, allowNull: true },
      gr_date: { type: Sequelize.DATEONLY, allowNull: true },
      location: { type: Sequelize.STRING(200), allowNull: true },
      bin: { type: Sequelize.STRING(200), allowNull: true },
      invoice_no: { type: Sequelize.STRING(100), allowNull: true },
      po_no: { type: Sequelize.STRING(100), allowNull: true },
      clone: { type: Sequelize.STRING(200), allowNull: true },
      price: { type: Sequelize.DECIMAL(14, 4), allowNull: true },
      received_by: { type: Sequelize.STRING(200), allowNull: true },
      received_at: { type: Sequelize.DATE, allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      coa_file_path: { type: Sequelize.STRING(500), allowNull: true },
      coa_filename: { type: Sequelize.STRING(255), allowNull: true },
      other_docs_file_path: { type: Sequelize.STRING(500), allowNull: true },
      other_docs_filename: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_batches')
  },
}
