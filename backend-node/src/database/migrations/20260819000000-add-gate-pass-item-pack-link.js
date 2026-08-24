'use strict'

// Links a gate pass line item to a specific batch/pack (SKU) so the item can
// carry its own UOM/quantity sourced from that pack and have stock deducted
// from it on submit — mirrors inv_stock_requests' source_batch_id/
// source_pack_id link (20260817000000-add-stock-request-batch-link.js).
// Left null for gate passes raised without picking a specific pack.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('inv_gate_pass_items', 'source_batch_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'inv_batches', key: 'id' },
      onDelete: 'SET NULL',
    })
    await queryInterface.addColumn('inv_gate_pass_items', 'source_pack_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'inv_batch_packs', key: 'id' },
      onDelete: 'SET NULL',
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('inv_gate_pass_items', 'source_pack_id')
    await queryInterface.removeColumn('inv_gate_pass_items', 'source_batch_id')
  },
}
