'use strict'

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('roles', [
  {
    "id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "code": "HOD",
    "name": "Head of Department",
    "description": null,
    "is_active": true,
    "created_at": "2026-06-27T22:06:38.100Z"
  },
  {
    "id": "216d9152-30bc-4d3e-af98-603651657235",
    "code": "ANALYST",
    "name": "Analyst",
    "description": null,
    "is_active": true,
    "created_at": "2026-07-04T11:19:42.464Z"
  },
  {
    "id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "code": "CHEM",
    "name": "Chemist",
    "description": null,
    "is_active": true,
    "created_at": "2026-06-27T22:06:38.100Z"
  },
  {
    "id": "52da95cb-64f1-4be1-81e6-c62762bffa6b",
    "code": "STORE_INCHARGE",
    "name": "Store Incharge",
    "description": null,
    "is_active": true,
    "created_at": "2026-07-04T11:19:42.468Z"
  },
  {
    "id": "609d2dbb-ffe4-41ee-968b-75d7709b6eaf",
    "code": "SUPER_ADMIN",
    "name": "Super Admin",
    "description": null,
    "is_active": true,
    "created_at": "2026-07-23T01:32:16.115Z"
  },
  {
    "id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "code": "TL",
    "name": "Team Lead",
    "description": null,
    "is_active": true,
    "created_at": "2026-06-27T22:06:38.100Z"
  }
], {})
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('roles', null, {})
  },
}
