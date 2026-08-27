'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('master_data_items', [
    {
      "id": "4c036547-9562-406b-b8f4-d1ddedcc85ee",
      "category": "ARD:UOM",
      "code": "ML",
      "name": "Milliliter",
      "description": null,
      "sort_order": 0,
      "is_active": true,
      "created_at": "2026-07-27T16:00:26.337Z",
      "created_by": null,
      "updated_by": null,
      "updated_at": null
    },
    {
      "id": "6ea8d0aa-f463-46a9-88f9-461c3dcb9b88",
      "category": "ARD:Sample Type",
      "code": "rm1",
      "name": "raw material",
      "description": "Raw Material",
      "sort_order": 0,
      "is_active": true,
      "created_at": "2026-08-07T08:59:02.748Z",
      "created_by": null,
      "updated_by": null,
      "updated_at": null
    },
    {
      "id": "823231b2-382a-47fa-8dbd-c23c9c6e0dde",
      "category": "ARD:Sample Type",
      "code": "ip",
      "name": "in progess",
      "description": "In progress",
      "sort_order": 0,
      "is_active": true,
      "created_at": "2026-08-07T08:59:52.750Z",
      "created_by": null,
      "updated_by": null,
      "updated_at": null
    },
    {
      "id": "f1ffe20b-ab68-43e8-bde1-3f9a8251af58",
      "category": "ARD:Chemical Grade",
      "code": "OQ-001",
      "name": "rfg",
      "description": "rfg",
      "sort_order": 0,
      "is_active": true,
      "created_at": "2026-08-24T07:12:24.538Z",
      "created_by": null,
      "updated_by": null,
      "updated_at": null
    }
  ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('master_data_items', null, {});
  },
};
