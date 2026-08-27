'use strict'

// Notebook status model simplified to exactly 3 values: ACTIVE, CLOSED, DEACTIVE.
// Previously it was OPEN / CLOSED / ARCHIVED.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE ard_notebooks SET status = 'ACTIVE' WHERE status = 'OPEN'`
    )
    await queryInterface.sequelize.query(
      `UPDATE ard_notebooks SET status = 'DEACTIVE' WHERE status = 'ARCHIVED'`
    )
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE ard_notebooks SET status = 'OPEN' WHERE status = 'ACTIVE'`
    )
    await queryInterface.sequelize.query(
      `UPDATE ard_notebooks SET status = 'ARCHIVED' WHERE status = 'DEACTIVE'`
    )
  },
}
