'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_test_configurations', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      config_code: { type: Sequelize.STRING, allowNull: true },
      technique_code: { type: Sequelize.STRING, allowNull: false },
      technique_name: { type: Sequelize.STRING, allowNull: false },
      test_type: { type: Sequelize.STRING, allowNull: false },
      test_subtype: { type: Sequelize.STRING, allowNull: true },
      result_params: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      updated_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: true },
      updated_at: { type: Sequelize.DATE, allowNull: true },
      analysis_technical_code: { type: Sequelize.STRING, allowNull: true },
      method_reference: { type: Sequelize.STRING, allowNull: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_test_configurations')
  },
}
