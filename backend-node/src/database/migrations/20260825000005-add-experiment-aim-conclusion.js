'use strict'

// Aim/Objective and Conclusion are fixed, always-present rich-text blocks on
// every experiment — same pattern as the Attachments panel (not something
// authored per-template via the Section library).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ard_experiments', 'aim', {
      type: Sequelize.TEXT,
      allowNull: true,
    })
    await queryInterface.addColumn('ard_experiments', 'conclusion', {
      type: Sequelize.TEXT,
      allowNull: true,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ard_experiments', 'aim')
    await queryInterface.removeColumn('ard_experiments', 'conclusion')
  },
}
