'use strict'

// inv_batch_number_counter.year was sized varchar(2) for plain batch-number
// years ("26"), but stockRequests.routes.ts's generateRequestNo() also keys
// into this same counter table with a prefixed "SR_26" (5 chars) to keep its
// sequence separate from batch numbering — that insert has been failing on
// every stock request creation with "value too long for type character
// varying(2)". Widen the column so both key shapes fit.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('inv_batch_number_counter', 'year', {
      type: Sequelize.STRING(20),
      allowNull: false,
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('inv_batch_number_counter', 'year', {
      type: Sequelize.STRING(2),
      allowNull: false,
    })
  },
}
