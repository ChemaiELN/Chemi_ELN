'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('ard_teams', [
      {
        id: "bdea08dd-9ac1-477f-8cf2-01c09a7a757f",
        name: "B Team",
        description: null,
        hod_id: "5e34985b-5fed-4a76-88ed-0fadda403882",
        tl_id: null,
        member_ids: "[\"28f23f07-5b97-46fa-a575-523415812c0b\",\"0df129a7-c4db-4896-b567-34dd9f167e51\",\"817961eb-8367-457f-8aeb-adf457644e72\",\"317d4af3-ce30-4a79-a461-d369c2d896cc\"]",
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        created_at: new Date("2026-08-24T07:43:29.619Z"),
        updated_at: new Date("2026-08-24T07:43:29.619Z"),
        tl_ids: "[\"da9bb7d9-0493-41e7-b298-004da29478f9\"]",
        tl_analyst_map: "{\"da9bb7d9-0493-41e7-b298-004da29478f9\":[\"28f23f07-5b97-46fa-a575-523415812c0b\",\"0df129a7-c4db-4896-b567-34dd9f167e51\",\"817961eb-8367-457f-8aeb-adf457644e72\",\"317d4af3-ce30-4a79-a461-d369c2d896cc\"]}",
        tl_analyst_can_review: "{}"
      },
      {
        id: "d795b87e-6167-41e1-8453-5a7dff8cccec",
        name: "A Team",
        description: null,
        hod_id: "5e34985b-5fed-4a76-88ed-0fadda403882",
        tl_id: null,
        member_ids: "[\"7111b5c0-7fb0-419a-8c25-dab33e78ab1e\",\"c7667e6a-8fc5-44e6-906e-d23bc0d462a5\",\"5edbc18f-5937-4458-a073-81461acbd6f2\",\"f43c3f9b-ae81-4065-a627-063307c9d997\"]",
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        created_at: new Date("2026-08-24T07:42:44.004Z"),
        updated_at: new Date("2026-08-24T07:42:44.004Z"),
        tl_ids: "[\"317d4af3-ce30-4a79-a461-d369c2d896cc\"]",
        tl_analyst_map: "{\"317d4af3-ce30-4a79-a461-d369c2d896cc\":[\"7111b5c0-7fb0-419a-8c25-dab33e78ab1e\",\"c7667e6a-8fc5-44e6-906e-d23bc0d462a5\",\"5edbc18f-5937-4458-a073-81461acbd6f2\",\"f43c3f9b-ae81-4065-a627-063307c9d997\"]}",
        tl_analyst_can_review: "{}"
      },
      {
        id: "f724b363-b6df-4d00-a2cb-667faaa3c4b0",
        name: "ard 1",
        description: null,
        hod_id: "5e34985b-5fed-4a76-88ed-0fadda403882",
        tl_id: null,
        member_ids: "[\"542fa9ad-0cc9-4252-acd9-3429e4fc9826\",\"6e525c6f-ce0b-45d3-abba-f61cc13a96f1\",\"f2229c56-b2eb-4f46-886d-95b801b93975\"]",
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        created_at: new Date("2026-08-07T07:40:53.550Z"),
        updated_at: new Date("2026-08-24T07:14:05.347Z"),
        tl_ids: "[\"f43c3f9b-ae81-4065-a627-063307c9d997\"]",
        tl_analyst_map: "{\"f43c3f9b-ae81-4065-a627-063307c9d997\":[\"542fa9ad-0cc9-4252-acd9-3429e4fc9826\",\"6e525c6f-ce0b-45d3-abba-f61cc13a96f1\",\"f2229c56-b2eb-4f46-886d-95b801b93975\"]}",
        tl_analyst_can_review: "{}"
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('ard_teams', null, {});
  }
};
