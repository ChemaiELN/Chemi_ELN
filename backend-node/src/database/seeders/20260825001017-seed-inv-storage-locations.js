'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('inv_storage_locations', [
    {
      "id": 1,
      "name": "ADC PD S1",
      "is_active": true,
      "created_at": "2026-07-26T19:31:37.232Z",
      "updated_at": "2026-07-27T00:24:06.030Z",
      "description": "its placed in the second floor GCB1"
    },
    {
      "id": 4,
      "name": "CGT-PD DSP",
      "is_active": true,
      "created_at": "2026-08-04T23:09:37.238Z",
      "updated_at": "2026-08-04T23:09:37.238Z",
      "description": null
    },
    {
      "id": 5,
      "name": "CGT-PD",
      "is_active": true,
      "created_at": "2026-08-04T23:10:20.876Z",
      "updated_at": "2026-08-04T23:10:20.876Z",
      "description": null
    },
    {
      "id": 6,
      "name": "CGT-PD (Autoclave room)",
      "is_active": true,
      "created_at": "2026-08-04T23:11:18.008Z",
      "updated_at": "2026-08-04T23:11:18.008Z",
      "description": null
    },
    {
      "id": 7,
      "name": "CGT-PD (USP mammalian)",
      "is_active": true,
      "created_at": "2026-08-04T23:11:46.619Z",
      "updated_at": "2026-08-04T23:11:46.619Z",
      "description": null
    },
    {
      "id": 8,
      "name": "CGT-PD (USP microbial)",
      "is_active": true,
      "created_at": "2026-08-04T23:12:14.977Z",
      "updated_at": "2026-08-04T23:12:14.977Z",
      "description": null
    },
    {
      "id": 9,
      "name": "AB-AD",
      "is_active": true,
      "created_at": "2026-08-04T23:14:14.138Z",
      "updated_at": "2026-08-04T23:14:14.138Z",
      "description": null
    }
  ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('inv_storage_locations', null, {});
  },
};
