'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('ard_analyst_qualifications', [
      {
        id: "6fc19804-5988-4f32-bf2e-483054ff1339",
        user_id: "6e525c6f-ce0b-45d3-abba-f61cc13a96f1",
        technique_entries: "[{\"techniqueId\":\"HPLC\",\"startDate\":\"2026-01-01\",\"endDate\":\"2030-01-01\",\"certificationPath\":null}]",
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        created_at: new Date("2026-07-28T03:13:09.082Z"),
        updated_at: new Date("2026-07-28T03:13:37.728Z"),
        valid_till: null,
        remarks: null,
        approval_status: null,
        approved_by: null,
        approved_at: null
      },
      {
        id: "f4804e37-7711-45f1-a6f3-cdda5f5a1a13",
        user_id: "542fa9ad-0cc9-4252-acd9-3429e4fc9826",
        technique_entries: "[{\"techniqueId\":\"602a0b51-4b72-4a19-aaa2-37949824d587\",\"startDate\":\"2026-07-31\",\"endDate\":\"2026-08-31\",\"certificationPath\":\"uploads\\\\ard_qualifications\\\\2244881f07ae4d7781abca47a44a8280.pdf\"}]",
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        created_at: new Date("2026-07-31T04:56:00.386Z"),
        updated_at: new Date("2026-07-31T05:12:46.928Z"),
        valid_till: null,
        remarks: null,
        approval_status: null,
        approved_by: null,
        approved_at: null
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('ard_analyst_qualifications', null, {});
  }
};
