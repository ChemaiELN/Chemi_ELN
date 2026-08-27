'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('ard_techniques', [
      {
        id: "0fab163d-14e3-41aa-a1cb-f109978c2de0",
        code: "HPLC",
        name: "High Performance Liquid Chromatography",
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: null,
        created_at: new Date("2026-07-27T15:38:55.058Z"),
        updated_at: null
      },
      {
        id: "602a0b51-4b72-4a19-aaa2-37949824d587",
        code: "tech-001",
        name: "assay",
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: null,
        created_at: new Date("2026-07-31T04:46:44.076Z"),
        updated_at: null
      },
      {
        id: "8da98941-d52f-4175-9eae-2c011483135b",
        code: "ADC",
        name: "Sodium",
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        created_at: new Date("2026-08-24T06:54:23.323Z"),
        updated_at: new Date("2026-08-24T06:55:02.240Z")
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('ard_techniques', null, {});
  }
};
