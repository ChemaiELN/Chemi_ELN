'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('inv_general_lookup', [
    {
      "id": 85,
      "lookup_type": "Instrument UOM",
      "lookup_value": "Inches of Water Column",
      "lookup_code": "Inches Wc",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 86,
      "lookup_type": "Instrument UOM",
      "lookup_value": "inches",
      "lookup_code": "inch",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 87,
      "lookup_type": "Instrument UOM",
      "lookup_value": "Celsius",
      "lookup_code": "Celsius",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 88,
      "lookup_type": "Instrument UOM",
      "lookup_value": "Fahrenheit",
      "lookup_code": "Fahrenheit",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 89,
      "lookup_type": "Inventory UOM",
      "lookup_value": "Kg",
      "lookup_code": "Kg",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 90,
      "lookup_type": "Inventory UOM",
      "lookup_value": "gm",
      "lookup_code": "gm",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 91,
      "lookup_type": "Inventory UOM",
      "lookup_value": "mg",
      "lookup_code": "mg",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 92,
      "lookup_type": "Inventory UOM",
      "lookup_value": "lt",
      "lookup_code": "lt",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 93,
      "lookup_type": "Material Type",
      "lookup_value": "RAW MATERIAL",
      "lookup_code": "RAW_MATERIAL",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 94,
      "lookup_type": "Material Type",
      "lookup_value": "FINISHED PRODUCTS",
      "lookup_code": "FINISHED_PRODUCTS",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 95,
      "lookup_type": "Material Type",
      "lookup_value": "PACKAGING MATERIAL",
      "lookup_code": "PACKAGING_MATERIAL",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 96,
      "lookup_type": "Material Type",
      "lookup_value": "Raw Material",
      "lookup_code": "RM",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 97,
      "lookup_type": "Material Type",
      "lookup_value": "Outside Party",
      "lookup_code": "OP",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 98,
      "lookup_type": "Material Type",
      "lookup_value": "Primary Standard",
      "lookup_code": "PS",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 99,
      "lookup_type": "Material Type",
      "lookup_value": "Reference Standard",
      "lookup_code": "RS",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 100,
      "lookup_type": "Material Type",
      "lookup_value": "Working Standard",
      "lookup_code": "WS",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 101,
      "lookup_type": "Material Type",
      "lookup_value": "Material Code",
      "lookup_code": "RND_MAT_",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 102,
      "lookup_type": "Material Type",
      "lookup_value": "Chemical & Solvents",
      "lookup_code": "CS",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 103,
      "lookup_type": "Material Type",
      "lookup_value": "Antibody Materials",
      "lookup_code": "ABM",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-07-13T06:34:50.740Z"
    },
    {
      "id": 104,
      "lookup_type": "Material Type",
      "lookup_value": "Linker-Payload",
      "lookup_code": "LPL",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 105,
      "lookup_type": "Material Type",
      "lookup_value": "Reagents and Salts",
      "lookup_code": "reagents-salts",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 106,
      "lookup_type": "Material Type",
      "lookup_value": "Consumables",
      "lookup_code": "consumables",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 107,
      "lookup_type": "Stability UOM",
      "lookup_value": "gms",
      "lookup_code": "gms",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 108,
      "lookup_type": "Stability UOM",
      "lookup_value": "mg",
      "lookup_code": "mg",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 109,
      "lookup_type": "Stability UOM",
      "lookup_value": "ml",
      "lookup_code": "ml",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 110,
      "lookup_type": "Stability UOM",
      "lookup_value": "Tablets",
      "lookup_code": "Tablets",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 111,
      "lookup_type": "Stability UOM",
      "lookup_value": "Bottle",
      "lookup_code": "Bottle",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 112,
      "lookup_type": "Stability UOM",
      "lookup_value": "Capsule",
      "lookup_code": "Capsule",
      "is_active": true,
      "created_by": null,
      "created_at": "2026-06-28T09:35:27.653Z",
      "updated_at": "2026-06-28T09:35:27.653Z"
    },
    {
      "id": 113,
      "lookup_type": "Material Type",
      "lookup_value": "Free Samples-WS",
      "lookup_code": "FS",
      "is_active": true,
      "created_by": "qa.hod",
      "created_at": "2026-07-13T06:37:52.156Z",
      "updated_at": "2026-07-13T06:37:52.156Z"
    },
    {
      "id": 114,
      "lookup_type": "CUSTOM",
      "lookup_value": "Updated by smoke test",
      "lookup_code": "TSTCODE6368",
      "is_active": false,
      "created_by": "qa.hod",
      "created_at": "2026-07-15T02:19:43.995Z",
      "updated_at": "2026-07-15T02:42:30.985Z"
    },
    {
      "id": 115,
      "lookup_type": "Technical Grade",
      "lookup_value": "ACS",
      "lookup_code": "ACS",
      "is_active": true,
      "created_by": "314651f7-bf0a-48d1-a363-bec45322e137",
      "created_at": "2026-08-16T03:04:00.953Z",
      "updated_at": "2026-08-16T03:04:00.953Z"
    },
    {
      "id": 116,
      "lookup_type": "Technical Grade",
      "lookup_value": "HPLC",
      "lookup_code": "HPLC",
      "is_active": true,
      "created_by": "314651f7-bf0a-48d1-a363-bec45322e137",
      "created_at": "2026-08-16T03:04:01.061Z",
      "updated_at": "2026-08-16T03:04:01.061Z"
    },
    {
      "id": 117,
      "lookup_type": "Technical Grade",
      "lookup_value": "TMG",
      "lookup_code": "TMG",
      "is_active": true,
      "created_by": "314651f7-bf0a-48d1-a363-bec45322e137",
      "created_at": "2026-08-16T03:04:01.115Z",
      "updated_at": "2026-08-16T03:04:01.115Z"
    },
    {
      "id": 118,
      "lookup_type": "Technical Grade",
      "lookup_value": "Other",
      "lookup_code": "OTHER",
      "is_active": true,
      "created_by": "314651f7-bf0a-48d1-a363-bec45322e137",
      "created_at": "2026-08-16T03:04:01.168Z",
      "updated_at": "2026-08-16T03:04:01.168Z"
    }
  ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('inv_general_lookup', null, {});
  },
};
