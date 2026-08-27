'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('inv_consumable_types', [
    {
      "id": 1,
      "name": "Filter",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T01:47:42.931Z",
      "updated_at": "2026-07-15T02:55:29.857Z"
    },
    {
      "id": 2,
      "name": "Plastic Ware",
      "description": "",
      "is_active": true,
      "created_at": "2026-06-28T01:47:42.931Z",
      "updated_at": "2026-07-15T02:24:59.384Z"
    },
    {
      "id": 3,
      "name": "Pipette Tips",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T01:47:42.931Z",
      "updated_at": "2026-06-28T01:47:42.931Z"
    },
    {
      "id": 4,
      "name": "Glassware",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T01:47:42.931Z",
      "updated_at": "2026-07-15T02:26:31.673Z"
    },
    {
      "id": 5,
      "name": "Membrane",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T01:47:42.931Z",
      "updated_at": "2026-06-28T01:47:42.931Z"
    },
    {
      "id": 6,
      "name": "Syringe",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T01:47:42.931Z",
      "updated_at": "2026-06-28T01:47:42.931Z"
    },
    {
      "id": 7,
      "name": "Tube",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T01:47:42.931Z",
      "updated_at": "2026-06-28T01:47:42.931Z"
    },
    {
      "id": 8,
      "name": "Microcentrifuge Tube",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T01:47:42.931Z",
      "updated_at": "2026-06-28T01:47:42.931Z"
    },
    {
      "id": 9,
      "name": "Centrifuge Tube",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T01:47:42.931Z",
      "updated_at": "2026-07-15T02:41:31.238Z"
    },
    {
      "id": 10,
      "name": "Spin Column",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T01:47:42.931Z",
      "updated_at": "2026-06-28T01:47:42.931Z"
    },
    {
      "id": 11,
      "name": "96-Well Plate",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T01:47:42.931Z",
      "updated_at": "2026-06-28T01:47:42.931Z"
    },
    {
      "id": 12,
      "name": "Vial",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T01:47:42.931Z",
      "updated_at": "2026-06-28T01:47:42.931Z"
    },
    {
      "id": 13,
      "name": "Sealing Film",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T01:47:42.931Z",
      "updated_at": "2026-06-28T01:47:42.931Z"
    },
    {
      "id": 14,
      "name": "Sterile Filter Unit",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T01:47:42.931Z",
      "updated_at": "2026-06-28T01:47:42.931Z"
    },
    {
      "id": 15,
      "name": "Cuvette",
      "description": null,
      "is_active": true,
      "created_at": "2026-06-28T01:47:42.931Z",
      "updated_at": "2026-06-28T01:47:42.931Z"
    },
    {
      "id": 18,
      "name": "Capsule Filters",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 19,
      "name": "Cartridges and Gaskets",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 20,
      "name": "Chromatography Columns",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 21,
      "name": "Chromatography Filter",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 22,
      "name": "Clamps",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 23,
      "name": "Depth Filters",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 24,
      "name": "Glass Bottle",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 25,
      "name": "Ice Bucket",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 26,
      "name": "Kits",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 27,
      "name": "Magnetic Bead",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 28,
      "name": "Measuring Beaker",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 29,
      "name": "Measuring Cylinder",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 30,
      "name": "Reducer Connector",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 31,
      "name": "Storage Bottle",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 32,
      "name": "TFF Cassettes",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 33,
      "name": "Waste Container",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 34,
      "name": "Adapter",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 35,
      "name": "Biohazard Bags",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 36,
      "name": "Bottles",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 37,
      "name": "Buffer",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 38,
      "name": "Cap Tubes",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 39,
      "name": "Caps",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 40,
      "name": "Clamp",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 41,
      "name": "Clamp Rod",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 42,
      "name": "Clamps Base",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 43,
      "name": "Connectors",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 44,
      "name": "Cooler",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 45,
      "name": "Dish",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 46,
      "name": "Electrode",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 47,
      "name": "Filter Tips",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 48,
      "name": "Fits",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 49,
      "name": "Film",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 50,
      "name": "Gas",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 51,
      "name": "Gels",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 52,
      "name": "Gloves",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 53,
      "name": "Insert Plug",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 54,
      "name": "Luer Lock",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 55,
      "name": "PCR Cartridges",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 56,
      "name": "PCR Plates",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 57,
      "name": "Pipette",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 58,
      "name": "Pipette Filter",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 59,
      "name": "Pipette Gun",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 60,
      "name": "Pipette Storage Rack",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 61,
      "name": "Plates",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 62,
      "name": "Pouch",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 63,
      "name": "Probe",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 64,
      "name": "Sensor",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 65,
      "name": "Silicon Tubing",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 66,
      "name": "Spreader",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 67,
      "name": "Stand",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 68,
      "name": "Sticky Pad",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 69,
      "name": "Strips",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 70,
      "name": "Tape",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 71,
      "name": "Valves",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 72,
      "name": "Vent Cap",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    },
    {
      "id": 73,
      "name": "Weighing Dish",
      "description": null,
      "is_active": true,
      "created_at": "2026-08-04T09:47:35.817Z",
      "updated_at": "2026-08-04T09:47:35.817Z"
    }
  ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('inv_consumable_types', null, {});
  },
};
