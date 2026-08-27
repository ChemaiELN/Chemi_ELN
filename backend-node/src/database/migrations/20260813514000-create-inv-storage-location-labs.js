'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_storage_location_labs', {
      storage_location_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: { model: 'inv_storage_locations', key: 'id' },
        onDelete: 'CASCADE',
      },
      lab_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        references: { model: 'labs', key: 'id' },
        onDelete: 'CASCADE',
      },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_storage_location_labs')
  },
}
