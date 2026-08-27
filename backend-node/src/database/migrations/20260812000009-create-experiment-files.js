'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('experiment_files', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      experiment_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'experiments', key: 'id' },
        onDelete: 'CASCADE',
      },
      section_key: { type: Sequelize.STRING(100), allowNull: true },
      filename: { type: Sequelize.STRING(255), allowNull: false },
      file_path: { type: Sequelize.STRING(500), allowNull: false },
      file_size: { type: Sequelize.BIGINT, allowNull: true },
      file_type: { type: Sequelize.STRING(50), allowNull: true },
      uploaded_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      uploaded_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('experiment_files')
  },
}
