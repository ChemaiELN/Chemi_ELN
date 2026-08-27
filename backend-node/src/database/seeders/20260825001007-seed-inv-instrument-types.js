'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('inv_instrument_types', [
    {
      "id": 1,
      "code": "IT-001",
      "name": "UV Detector",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 2,
      "code": "IT-002",
      "name": "RI Detector",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 3,
      "code": "IT-003",
      "name": "Autosampler",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 4,
      "code": "IT-004",
      "name": "Column Oven",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 5,
      "code": "IT-005",
      "name": "Quaternary Pump",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 6,
      "code": "IT-006",
      "name": "DAD Detector",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 7,
      "code": "IT-007",
      "name": "Fluorescence Detector",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 8,
      "code": "IT-008",
      "name": "Mass Spec Detector",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 9,
      "code": "IT-009",
      "name": "pH Meter",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 10,
      "code": "IT-010",
      "name": "Conductivity Meter",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 11,
      "code": "TSTD00F",
      "name": "Test Instrument Types 08f2ac",
      "description": "updated by smoke test",
      "is_active": true,
      "created_at": "2026-07-15T01:58:40.844Z"
    },
    {
      "id": 12,
      "code": "TST775E",
      "name": "Test Instrument Types d1d2c5",
      "description": "updated by smoke test",
      "is_active": false,
      "created_at": "2026-07-15T02:18:56.529Z"
    }
  ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('inv_instrument_types', null, {});
  },
};
