'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('id_sequence_counters', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      config_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'id_sequence_configs', key: 'id' },
        onDelete: 'CASCADE',
      },
      year: { type: Sequelize.SMALLINT, allowNull: true },
      period: { type: Sequelize.STRING(10), allowNull: true },
      last_value: { type: Sequelize.INTEGER, defaultValue: 0 },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('id_sequence_counters')
  },
}
