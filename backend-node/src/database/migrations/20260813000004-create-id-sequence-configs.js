'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('id_sequence_configs', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      label: { type: Sequelize.STRING(150), allowNull: false },
      prefix: { type: Sequelize.STRING(20), allowNull: true },
      separator: { type: Sequelize.STRING(5), defaultValue: '/' },
      include_year: { type: Sequelize.BOOLEAN, defaultValue: true },
      year_digits: { type: Sequelize.SMALLINT, defaultValue: 2 },
      sequence_digits: { type: Sequelize.SMALLINT, defaultValue: 5 },
      reset_yearly: { type: Sequelize.BOOLEAN, defaultValue: true },
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
    await queryInterface.dropTable('id_sequence_configs')
  },
}
