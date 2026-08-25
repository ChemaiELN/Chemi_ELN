'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_gate_pass_returns', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      gate_pass_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_gate_passes', key: 'id' },
        onDelete: 'CASCADE',
      },
      return_gp_number: { type: Sequelize.STRING(50), allowNull: false },
      return_date: { type: Sequelize.DATEONLY, allowNull: false },
      item_sr_no: { type: Sequelize.INTEGER, allowNull: false },
      received_qty: { type: Sequelize.DECIMAL(14, 3), allowNull: false, defaultValue: 0 },
      condition: { type: Sequelize.STRING(20), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      received_by: { type: Sequelize.STRING(200), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_gate_pass_returns')
  },
}
