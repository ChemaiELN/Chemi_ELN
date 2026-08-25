'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_instrument_spec_details', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      instrument_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_instrument_catalogue', key: 'id' },
        onDelete: 'CASCADE',
      },
      specification: { type: Sequelize.STRING(255), allowNull: false },
      value: { type: Sequelize.STRING(255), allowNull: true },
      uom: { type: Sequelize.STRING(50), allowNull: true },
      seq_no: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      created_at: { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_instrument_spec_details')
  },
}
