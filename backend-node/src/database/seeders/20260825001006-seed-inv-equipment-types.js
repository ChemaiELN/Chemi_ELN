'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('inv_equipment_types', [
    {
      "id": 1,
      "code": "ET-001",
      "name": "HPLC System",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 2,
      "code": "ET-002",
      "name": "GC-MS System",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 3,
      "code": "ET-003",
      "name": "UV-Vis Spectrophotometer",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 4,
      "code": "ET-004",
      "name": "Analytical Balance",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 5,
      "code": "ET-005",
      "name": "Karl Fischer Titrator",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 6,
      "code": "ET-006",
      "name": "Dissolution Apparatus",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 7,
      "code": "ET-007",
      "name": "Freeze Dryer",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 8,
      "code": "ET-008",
      "name": "Particle Size Analyzer",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 9,
      "code": "TST17DD",
      "name": "Test Equipment Types f7a6e9",
      "description": "updated by smoke test",
      "is_active": true,
      "created_at": "2026-07-15T01:58:32.619Z"
    },
    {
      "id": 10,
      "code": "TSTEC8F",
      "name": "Test Equipment Types f4789b",
      "description": "updated by smoke test",
      "is_active": true,
      "created_at": "2026-07-15T02:18:48.244Z"
    }
  ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('inv_equipment_types', null, {});
  },
};
