'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('inv_column_types', [
    {
      "id": 1,
      "code": "TSTCOL1770",
      "name": "Test Column 6d29f0",
      "description": "smoke test",
      "length_mm": "250.00",
      "particle_size_um": "5.00",
      "pore_size_angstrom": "100.00",
      "is_active": true,
      "created_at": "2026-07-15T01:58:49.093Z"
    },
    {
      "id": 2,
      "code": "TSTCOL0A74",
      "name": "Test Column 984fc4",
      "description": "smoke test",
      "length_mm": "250.00",
      "particle_size_um": "5.00",
      "pore_size_angstrom": "100.00",
      "is_active": true,
      "created_at": "2026-07-15T02:19:04.770Z"
    }
  ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('inv_column_types', null, {});
  },
};
