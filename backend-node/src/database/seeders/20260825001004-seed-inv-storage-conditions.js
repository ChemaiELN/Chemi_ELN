'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('inv_storage_conditions', [
    {
      "id": 1,
      "label": "Ultra-Low Temperature",
      "temperature_min": "-80.0",
      "temperature_max": "-25.0",
      "temperature_unit": "°C",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T05:49:01.605Z",
      "updated_at": "2026-06-28T05:49:27.795Z"
    },
    {
      "id": 2,
      "label": "Freezer",
      "temperature_min": "-25.0",
      "temperature_max": "-10.0",
      "temperature_unit": "°C",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T05:49:45.429Z",
      "updated_at": "2026-06-28T05:49:45.429Z"
    },
    {
      "id": 3,
      "label": "Refrigerator",
      "temperature_min": "2.0",
      "temperature_max": "8.0",
      "temperature_unit": "°C",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T05:50:02.546Z",
      "updated_at": "2026-06-28T05:50:02.546Z"
    },
    {
      "id": 4,
      "label": "Cool",
      "temperature_min": "8.0",
      "temperature_max": "15.0",
      "temperature_unit": "°C",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T05:50:27.904Z",
      "updated_at": "2026-06-28T05:50:27.904Z"
    },
    {
      "id": 7,
      "label": "RT",
      "temperature_min": "20.0",
      "temperature_max": "26.0",
      "temperature_unit": "°C",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T02:59:26.815Z",
      "updated_at": "2026-08-04T02:59:26.815Z"
    },
    {
      "id": 8,
      "label": "below -80 degrees",
      "temperature_min": "-200.0",
      "temperature_max": "-80.0",
      "temperature_unit": "°C",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T03:28:32.943Z",
      "updated_at": "2026-08-04T03:28:32.943Z"
    }
  ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('inv_storage_conditions', null, {});
  },
};
