'use strict'

// Pre-alter shape: source_batch_id/source_pack_id are added later by
// 20260819000000-add-gate-pass-item-pack-link.js.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_gate_pass_items', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      gate_pass_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_gate_passes', key: 'id' },
        onDelete: 'CASCADE',
      },
      sr_no: { type: Sequelize.INTEGER, allowNull: false },
      material_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inv_materials', key: 'id' },
        onDelete: 'SET NULL',
      },
      material_code: { type: Sequelize.STRING(50), allowNull: true },
      material_name: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      quantity: { type: Sequelize.DECIMAL(14, 3), allowNull: false, defaultValue: 0 },
      uom: { type: Sequelize.STRING(20), allowNull: true },
      rate: { type: Sequelize.DECIMAL(14, 2), allowNull: true },
      total_value: { type: Sequelize.DECIMAL(16, 2), allowNull: false, defaultValue: 0 },
      returned_qty: { type: Sequelize.DECIMAL(14, 3), allowNull: false, defaultValue: 0 },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_gate_pass_items')
  },
}
