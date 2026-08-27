'use strict'

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('departments', [
  {
    "id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "code": "ADC_PD",
    "name": "ADC PD",
    "description": null,
    "is_active": true,
    "created_by": null,
    "created_at": "2026-07-23T00:40:15.338Z",
    "updated_at": "2026-07-23T00:40:15.338Z"
  },
  {
    "id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "code": "CGT",
    "name": "CGT",
    "description": null,
    "is_active": true,
    "created_by": null,
    "created_at": "2026-07-23T00:40:15.360Z",
    "updated_at": "2026-07-23T00:40:15.360Z"
  },
  {
    "id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "code": "QA",
    "name": "QA",
    "description": null,
    "is_active": true,
    "created_by": null,
    "created_at": "2026-07-04T11:19:42.517Z",
    "updated_at": "2026-07-04T11:19:42.517Z"
  },
  {
    "id": "e3ec13a2-cff2-4431-9f63-e04d7e5c2e42",
    "code": "AD",
    "name": "AD",
    "description": null,
    "is_active": true,
    "created_by": null,
    "created_at": "2026-07-23T00:40:15.357Z",
    "updated_at": "2026-07-23T00:40:15.357Z"
  },
  {
    "id": "ea081128-11cb-4576-ada9-10ac0252103d",
    "code": "QC",
    "name": "QC",
    "description": null,
    "is_active": true,
    "created_by": null,
    "created_at": "2026-07-23T00:40:15.359Z",
    "updated_at": "2026-08-17T03:11:32.288Z"
  },
  {
    "id": "fe2c095d-a536-4314-b894-180177eb275a",
    "code": "INVENTORY",
    "name": "Inventory",
    "description": null,
    "is_active": true,
    "created_by": null,
    "created_at": "2026-07-23T00:40:15.361Z",
    "updated_at": "2026-08-22T02:23:44.620Z"
  }
], {})
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('departments', null, {})
  },
}
