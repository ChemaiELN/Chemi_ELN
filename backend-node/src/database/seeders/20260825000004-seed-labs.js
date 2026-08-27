'use strict'

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('labs', [
  {
    "id": "65d65823-dca7-4d65-bcd0-1594075c1fc8",
    "code": "ADCPDL2",
    "name": "ADC PD Lab 2",
    "description": null,
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "is_active": true,
    "created_by": "6b08f8fc-e208-4600-965f-806b773e27e9",
    "created_at": "2026-07-23T00:41:47.193Z",
    "updated_at": "2026-07-23T00:41:47.193Z"
  },
  {
    "id": "6ce92313-b0ef-42b5-8702-993a73cffd2e",
    "code": "CGTL1",
    "name": "CGT Lab 1",
    "description": null,
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "is_active": true,
    "created_by": "6b08f8fc-e208-4600-965f-806b773e27e9",
    "created_at": "2026-07-23T00:42:04.015Z",
    "updated_at": "2026-07-23T00:42:04.015Z"
  },
  {
    "id": "87b2642a-faf4-405c-86ec-2320866fe590",
    "code": "ADL1",
    "name": "AD Lab 1",
    "description": null,
    "department_id": "e3ec13a2-cff2-4431-9f63-e04d7e5c2e42",
    "is_active": true,
    "created_by": "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
    "created_at": "2026-08-04T23:13:36.608Z",
    "updated_at": "2026-08-04T23:13:36.608Z"
  },
  {
    "id": "dd7ed07c-2b12-4c00-821b-145c2c4de471",
    "code": "ADCPDL1",
    "name": "ADC PD Lab 1",
    "description": null,
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "is_active": true,
    "created_by": "6b08f8fc-e208-4600-965f-806b773e27e9",
    "created_at": "2026-07-23T00:41:23.597Z",
    "updated_at": "2026-07-23T00:41:23.597Z"
  },
  {
    "id": "e83f9f14-aa2e-4e5d-985d-364a3aff8787",
    "code": "CGTL2",
    "name": "CGT Lab 2",
    "description": null,
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "is_active": true,
    "created_by": "6b08f8fc-e208-4600-965f-806b773e27e9",
    "created_at": "2026-07-23T00:42:26.111Z",
    "updated_at": "2026-07-23T00:42:26.111Z"
  }
], {})
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('labs', null, {})
  },
}
