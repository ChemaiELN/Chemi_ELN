'use strict'

// Users can now belong to multiple labs (assigned from the "Add User to Department"
// form). The prior scalar users.lab_id only supported one lab per user; this join
// table adds many-to-many support without dropping that column, and existing
// single-lab assignments are backfilled here so nothing already saved is lost.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_labs', {
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      lab_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'labs', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    })

    await queryInterface.sequelize.query(`
      INSERT INTO user_labs (user_id, lab_id, created_at)
      SELECT id, lab_id, NOW() FROM users WHERE lab_id IS NOT NULL
    `)
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_labs')
  },
}
