'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_gate_passes', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      gp_number: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      doc_type: { type: Sequelize.STRING(20), allowNull: false },
      manufacturer_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_manufacturers', key: 'id' },
        onDelete: 'SET NULL',
      },
      vendor_code: { type: Sequelize.STRING(50), allowNull: true },
      vendor_name: { type: Sequelize.STRING(255), allowNull: true },
      gp_date: { type: Sequelize.DATEONLY, allowNull: false },
      pr_number: { type: Sequelize.STRING(100), allowNull: true },
      work_order_no: { type: Sequelize.STRING(100), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'DRAFT' },
      work_order_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_work_orders', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_by: { type: Sequelize.STRING(200), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      approved_by: { type: Sequelize.STRING(200), allowNull: true },
      approved_at: { type: Sequelize.DATE, allowNull: true },
      dispatched_by: { type: Sequelize.STRING(200), allowNull: true },
      dispatched_at: { type: Sequelize.DATE, allowNull: true },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_gate_passes')
  },
}
