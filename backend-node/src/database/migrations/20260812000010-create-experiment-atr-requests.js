'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('experiment_atr_requests', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      experiment_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'experiments', key: 'id' },
        onDelete: 'CASCADE',
      },
      atr_no: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      section_id: { type: Sequelize.STRING(100), allowNull: true },
      section_title: { type: Sequelize.STRING(255), allowNull: true },
      data_snapshot: { type: Sequelize.JSONB, allowNull: true },
      // ard_atr_form_id references ard_atr_forms, created in a different migration
      // batch (ARD module); left unconstrained here to avoid ordering coupling.
      ard_atr_form_id: { type: Sequelize.UUID, allowNull: true },
      status: { type: Sequelize.STRING(20), allowNull: true, defaultValue: 'PENDING' },
      raised_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      raised_at: { type: Sequelize.DATE },
      completed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      result_notes: { type: Sequelize.TEXT, allowNull: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('experiment_atr_requests')
  },
}
