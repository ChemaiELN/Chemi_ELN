'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lookup_instruments', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      instrument_code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      instrument_type: { type: Sequelize.STRING(100), allowNull: true },
      instrument_name: { type: Sequelize.STRING(200), allowNull: false },
      maintenance_status: { type: Sequelize.STRING(50), allowNull: true },
      calibration_status: { type: Sequelize.STRING(50), allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lookup_instruments')
  },
}
