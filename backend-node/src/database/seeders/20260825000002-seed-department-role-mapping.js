'use strict'

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('department_role_mapping', [
  {
    "id": "0aa51550-71cf-404e-9c12-5510e91d506f",
    "department_id": "ea081128-11cb-4576-ada9-10ac0252103d",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "created_at": "2026-08-12T01:30:27.784Z"
  },
  {
    "id": "12a54439-32d7-46f3-866f-a740014fee29",
    "department_id": "ea081128-11cb-4576-ada9-10ac0252103d",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "created_at": "2026-08-12T01:30:27.784Z"
  },
  {
    "id": "1f59a547-1fad-479b-8458-22dd4cf05781",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "created_at": "2026-08-12T01:30:27.784Z"
  },
  {
    "id": "2718e078-6d0b-4494-888a-5b42fbb0be85",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "created_at": "2026-08-12T01:30:27.784Z"
  },
  {
    "id": "38ac83a5-3d50-4d2f-8809-2486d20c55b1",
    "department_id": "ea081128-11cb-4576-ada9-10ac0252103d",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "created_at": "2026-08-12T01:30:27.784Z"
  },
  {
    "id": "4b6d85ae-818e-478b-88a1-f0d9cbcf7b37",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "216d9152-30bc-4d3e-af98-603651657235",
    "created_at": "2026-08-12T01:30:27.784Z"
  },
  {
    "id": "4d81a56b-c2c5-4b94-a2c4-8df867996540",
    "department_id": "ea081128-11cb-4576-ada9-10ac0252103d",
    "role_id": "216d9152-30bc-4d3e-af98-603651657235",
    "created_at": "2026-08-12T01:30:27.784Z"
  },
  {
    "id": "5bcb5e08-7a2f-4b8e-add0-f1b3fa16df29",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "created_at": "2026-08-12T01:30:27.784Z"
  },
  {
    "id": "722596a2-78c2-4f48-9240-af922a7dab72",
    "department_id": "e3ec13a2-cff2-4431-9f63-e04d7e5c2e42",
    "role_id": "216d9152-30bc-4d3e-af98-603651657235",
    "created_at": "2026-08-12T01:30:27.784Z"
  },
  {
    "id": "802a5238-1d39-4250-a58e-acf254e01924",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "created_at": "2026-08-12T01:30:27.784Z"
  },
  {
    "id": "8488e413-e697-4368-ac98-5486398a454a",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "created_at": "2026-08-12T01:30:27.784Z"
  },
  {
    "id": "9ae099a8-d421-4cbb-8f4e-7e1f77cf1f70",
    "department_id": "d21a86e1-1b9b-476d-a01f-325276cccbd3",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "created_at": "2026-08-12T01:30:27.784Z"
  },
  {
    "id": "9e240f09-4c16-4ca6-9395-fc82b4b3c430",
    "department_id": "e3ec13a2-cff2-4431-9f63-e04d7e5c2e42",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "created_at": "2026-08-12T01:30:27.784Z"
  },
  {
    "id": "a2cd28ce-9dc4-491c-b064-55daf007e211",
    "department_id": "e3ec13a2-cff2-4431-9f63-e04d7e5c2e42",
    "role_id": "d2f80c83-ef97-465f-b651-05676cbbbe91",
    "created_at": "2026-08-12T01:30:27.784Z"
  },
  {
    "id": "dd6ff520-ea30-4554-9f5a-ba6f581b4290",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "created_at": "2026-08-12T01:30:27.784Z"
  },
  {
    "id": "f15d701b-3896-4c61-b0c0-74eeaf787d69",
    "department_id": "fe2c095d-a536-4314-b894-180177eb275a",
    "role_id": "52da95cb-64f1-4be1-81e6-c62762bffa6b",
    "created_at": "2026-08-12T01:30:27.784Z"
  },
  {
    "id": "f1a99936-e71a-4ed0-963d-3877ac13a1bf",
    "department_id": "51a3f17b-27e3-4c4b-94e4-13771707292c",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "created_at": "2026-08-12T01:30:27.784Z"
  },
  {
    "id": "f5eac761-0ac8-4d89-8451-0b54f9899a10",
    "department_id": "e3ec13a2-cff2-4431-9f63-e04d7e5c2e42",
    "role_id": "48ec4a6f-8b00-4780-865d-797e32116378",
    "created_at": "2026-08-12T01:30:27.784Z"
  },
  {
    "id": "fc8978b7-6083-4045-bd3c-9c27b891e758",
    "department_id": "bfaa2390-53bf-41d5-9c6e-c0c16dfa9a5b",
    "role_id": "18ab7332-9845-4d65-89dd-51ebabefbdb8",
    "created_at": "2026-08-12T01:30:27.784Z"
  }
], {})
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('department_role_mapping', null, {})
  },
}
