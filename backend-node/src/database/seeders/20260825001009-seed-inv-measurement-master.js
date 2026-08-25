'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('inv_measurement_master', [
    {
      "id": 6,
      "name": "Test Measurement fb6670",
      "data_type": "DECIMAL",
      "uom": "g",
      "is_active": false,
      "created_at": "2026-07-15T01:58:57.353Z"
    },
    {
      "id": 7,
      "name": "Test Measurement 4afa7e",
      "data_type": "DECIMAL",
      "uom": "g",
      "is_active": false,
      "created_at": "2026-07-15T02:19:13.020Z"
    }
  ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('inv_measurement_master', null, {});
  },
};
