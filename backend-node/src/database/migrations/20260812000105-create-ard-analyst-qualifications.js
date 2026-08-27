'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ard_analyst_qualifications', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
      technique_entries: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      created_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      updated_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: true },
      updated_at: { type: Sequelize.DATE, allowNull: true },
      valid_till: { type: Sequelize.STRING, allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      approval_status: { type: Sequelize.STRING, allowNull: true },
      approved_by: { type: Sequelize.STRING, allowNull: true },
      approved_at: { type: Sequelize.DATE, allowNull: true },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_analyst_qualifications')
  },
}
