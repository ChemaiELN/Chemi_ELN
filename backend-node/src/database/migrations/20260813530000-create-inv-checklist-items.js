'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_checklist_items', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      checklist_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inv_checklists', key: 'id' },
        onDelete: 'CASCADE',
      },
      seq_no: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      instruction_type: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'INSTRUCTION' },
      data_type: { type: Sequelize.STRING(30), allowNull: true },
      frequencies: { type: Sequelize.JSONB, allowNull: true },
      precision: { type: Sequelize.INTEGER, allowNull: true },
      lower_limit: { type: Sequelize.DECIMAL(14, 4), allowNull: true },
      upper_limit: { type: Sequelize.DECIMAL(14, 4), allowNull: true },
      options: { type: Sequelize.JSONB, allowNull: true },
      details: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_checklist_items')
  },
}
