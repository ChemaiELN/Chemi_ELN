'use strict'

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('id_sequence_counters', [
  {
    "id": "06e9f60d-1b4e-447b-ba2c-5dd51c448b7c",
    "config_id": "e2bbc49f-03e6-4240-b764-522bc43e1ff5",
    "year": 2026,
    "last_value": 6,
    "period": null
  },
  {
    "id": "1198e017-edcb-4580-beca-30aa05b5d56e",
    "config_id": "a9c39990-f5e3-4428-8426-9d431780969b",
    "year": 2026,
    "last_value": 6,
    "period": null
  },
  {
    "id": "19296669-83e2-4617-8cdd-2fafbac7a6c2",
    "config_id": "67f691ec-e3f7-41d7-8b6e-f9682254338a",
    "year": 26,
    "last_value": 1,
    "period": null
  },
  {
    "id": "1d8d498a-2bb9-4e60-968a-a1004daf699a",
    "config_id": "782141d1-687e-48f3-9a3f-28f4b18c1920",
    "year": 2026,
    "last_value": 10,
    "period": null
  },
  {
    "id": "5ce28400-76b7-47dd-876b-0ff50577cfa7",
    "config_id": "3a9844f1-cff7-4dd7-b194-3789ff314a7c",
    "year": 2026,
    "last_value": 3,
    "period": null
  },
  {
    "id": "68a273f3-dd67-422e-b8a7-8926a2af2a30",
    "config_id": "9c1236db-cf61-4f7b-ad2e-de111c9f38b1",
    "year": 2026,
    "last_value": 3,
    "period": null
  },
  {
    "id": "9bb02991-2b8f-4483-95a9-dfabed67bc40",
    "config_id": "0f128e85-64a7-432c-886d-b2df8f45b619",
    "year": 26,
    "last_value": 10047,
    "period": null
  },
  {
    "id": "ba3bd3fe-5189-40e8-bc52-bfc7182f3ac7",
    "config_id": "67f691ec-e3f7-41d7-8b6e-f9682254338a",
    "year": 2026,
    "last_value": 11,
    "period": null
  },
  {
    "id": "bc5743d2-8cda-4960-8f55-f4f255b10c64",
    "config_id": "1913524a-cca9-4633-b4b5-085b403e547a",
    "year": 2026,
    "last_value": 25,
    "period": null
  },
  {
    "id": "cedd960d-a9ab-4b3f-bf1e-f9d5d00ce20a",
    "config_id": "fc8162ad-896c-402c-a935-205c2ac8d6e4",
    "year": 2026,
    "last_value": 4,
    "period": null
  },
  {
    "id": "dc07ccf3-ca24-4300-8c09-d246bf37551c",
    "config_id": "46ef153d-4232-46ea-8d6a-82adf5480431",
    "year": 2026,
    "last_value": 6,
    "period": null
  },
  {
    "id": "e1e89fa8-2bb5-4fc3-b297-65f9921f8c31",
    "config_id": "ed4ade81-9bdf-4d53-b17b-16a154aab90b",
    "year": 2026,
    "last_value": 6,
    "period": null
  },
  {
    "id": "e34b529e-8e01-441e-9d28-76876f7e5992",
    "config_id": "e2bbc49f-03e6-4240-b764-522bc43e1ff5",
    "year": 2026,
    "last_value": 10,
    "period": "20260807"
  },
  {
    "id": "f586e6ab-8cea-4684-bcb5-aa74bcf2ac90",
    "config_id": "782141d1-687e-48f3-9a3f-28f4b18c1920",
    "year": 26,
    "last_value": 1,
    "period": null
  }
], {})
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('id_sequence_counters', null, {})
  },
}
