'use strict'

// inv_batch_no_counter is legacy/unused-by-name alongside inv_batch_number_counter
// (both single-column year/last_seq counters) — created together since both are
// trivial counter tables. year is STRING(2) here; widened to STRING(20) for
// inv_batch_number_counter by 20260818000000-widen-batch-number-counter-year.js.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inv_batch_no_counter', {
      year: { type: Sequelize.STRING(2), primaryKey: true },
      last_seq: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 10000 },
    })

    await queryInterface.createTable('inv_batch_number_counter', {
      year: { type: Sequelize.STRING(2), primaryKey: true },
      last_seq: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inv_batch_number_counter')
    await queryInterface.dropTable('inv_batch_no_counter')
  },
}
