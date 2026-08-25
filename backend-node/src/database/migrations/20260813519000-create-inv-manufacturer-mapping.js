'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_manufacturer_mapping', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      material_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_materials', key: 'id' },
        onDelete: 'CASCADE',
      },
      manufacturer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_manufacturers', key: 'id' },
        onDelete: 'CASCADE',
      },
      catalogue_no: { type: Sequelize.STRING(100), allowNull: true },
      technical_grade: { type: Sequelize.STRING(100), allowNull: true },
      lead_time_days: { type: Sequelize.INTEGER, allowNull: true },
      min_order_qty: { type: Sequelize.DECIMAL(10, 3), allowNull: true },
      dsd_file_path: { type: Sequelize.STRING(500), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_manufacturer_mapping')
  },
}
