'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('ard_test_groups', [
      {
        id: "b2f0f4bd-631d-4f88-82c4-5e705741c24b",
        name: "Quenching",
        description: "",
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        created_at: new Date("2026-08-24T07:08:57.136Z"),
        updated_at: new Date("2026-08-24T07:10:07.458Z")
      },
      {
        id: "b850b0ce-5c28-4804-93f7-d02b6b88bfa5",
        name: "Release Testing",
        description: "",
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: null,
        created_at: new Date("2026-07-27T15:53:27.239Z"),
        updated_at: null
      },
      {
        id: "ff3218ee-db47-453e-9d41-340d644f683e",
        name: " vxc ",
        description: "",
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        created_at: new Date("2026-07-31T04:49:00.752Z"),
        updated_at: new Date("2026-07-31T05:13:20.279Z")
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('ard_test_groups', null, {});
  }
};
