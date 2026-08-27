'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // No rows currently exist in the source dev DB for this table.
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('lookup_chemicals', null, {});
  },
};
