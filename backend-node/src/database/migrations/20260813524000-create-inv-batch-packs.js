'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_batch_packs', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      batch_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_batches', key: 'id' },
        onDelete: 'CASCADE',
      },
      seq_no: { type: Sequelize.INTEGER, allowNull: false },
      pack_no: { type: Sequelize.STRING(100), allowNull: false },
      qty_per_pack: { type: Sequelize.DECIMAL(12, 4), allowNull: false },
      qty_available: { type: Sequelize.DECIMAL(12, 4), allowNull: false },
      inhouse_batch_no: { type: Sequelize.STRING(100), allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_batch_packs')
  },
}
