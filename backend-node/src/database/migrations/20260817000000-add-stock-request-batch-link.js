'use strict'

// Links a stock request to a specific existing batch/pack, powering the
// "raise a request directly from a SKU/Pack ID row in the Batches table"
// flow — distinct from the pre-existing plain material request flow (which
// leaves both columns null and is otherwise untouched).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('inv_stock_requests', 'source_batch_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'inv_batches', key: 'id' },
      onDelete: 'SET NULL',
    })
    await queryInterface.addColumn('inv_stock_requests', 'source_pack_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'inv_batch_packs', key: 'id' },
      onDelete: 'SET NULL',
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('inv_stock_requests', 'source_pack_id')
    await queryInterface.removeColumn('inv_stock_requests', 'source_batch_id')
  },
}
