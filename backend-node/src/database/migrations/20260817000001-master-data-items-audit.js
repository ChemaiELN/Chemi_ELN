'use strict'

// ARD lookups reuse master_data_items. The Configuration grid shows Created By /
// Updated By, but this shared table had no auditor columns, so the UI always
// fell back to "System". Nullable so existing admin/inventory rows stay valid.

async function addIfMissing(queryInterface, tableName, columnName, spec) {
  const table = await queryInterface.describeTable(tableName)
  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, spec)
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await addIfMissing(queryInterface, 'master_data_items', 'created_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    })
    await addIfMissing(queryInterface, 'master_data_items', 'updated_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    })
    await addIfMissing(queryInterface, 'master_data_items', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: true,
    })
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('master_data_items')
    if (table.updated_at) await queryInterface.removeColumn('master_data_items', 'updated_at')
    if (table.updated_by) await queryInterface.removeColumn('master_data_items', 'updated_by')
    if (table.created_by) await queryInterface.removeColumn('master_data_items', 'created_by')
  },
}
