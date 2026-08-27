'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lookup_chemicals', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      chemical_name: { type: Sequelize.STRING(255), allowNull: false },
      cas_no: { type: Sequelize.STRING(50), allowNull: true },
      formula: { type: Sequelize.STRING(100), allowNull: true },
      mol_wt: { type: Sequelize.DECIMAL(10, 4), allowNull: true },
      vendor_name: { type: Sequelize.STRING(200), allowNull: true },
      density: { type: Sequelize.DECIMAL(10, 4), allowNull: true },
      purity_pct: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
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
    await queryInterface.dropTable('lookup_chemicals')
  },
}
