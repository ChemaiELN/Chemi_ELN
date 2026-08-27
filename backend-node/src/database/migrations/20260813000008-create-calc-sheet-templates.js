'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('calc_sheet_templates', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      name: { type: Sequelize.STRING(255), allowNull: false },
      slug: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      category: { type: Sequelize.STRING(100), allowNull: true },
      version: { type: Sequelize.INTEGER, defaultValue: 1 },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      workbook_data: { type: Sequelize.JSONB, allowNull: true },
      field_metadata: { type: Sequelize.JSONB, allowNull: true },
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
    await queryInterface.dropTable('calc_sheet_templates')
  },
}
