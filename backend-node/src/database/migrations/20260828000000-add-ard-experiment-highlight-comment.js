'use strict'

// The "HighLight" action on the Notebook's Experiments tab pairs the existing
// highlighted flag with a short comment explaining why (legacy "Edit
// Highlight Comment" modal) — needs its own column since highlighted was
// previously just a bare boolean with no room for that text.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ard_experiments', 'highlight_comment', {
      type: Sequelize.TEXT,
      allowNull: true,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ard_experiments', 'highlight_comment')
  },
}
