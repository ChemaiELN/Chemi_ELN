'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('ard_attributes', [
      {
        id: "4959b701-8f3d-4f7a-ae84-569fd218b299",
        name: "sfs",
        label: "sfs",
        field_type: "text",
        required: false,
        max_length: null,
        options: null,
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        created_at: new Date("2026-07-31T04:48:42.843Z"),
        updated_at: new Date("2026-07-31T05:13:28.814Z")
      },
      {
        id: "74f2f553-1c75-4552-b30f-395428ffc8f1",
        name: "freezer",
        label: "Freezer",
        field_type: "text",
        required: false,
        max_length: 12,
        options: null,
        is_active: false,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        created_at: new Date("2026-08-24T07:11:23.106Z"),
        updated_at: new Date("2026-08-24T07:11:26.587Z")
      },
      {
        id: "ca282fb2-efa8-487a-b654-89276720d1f4",
        name: "batchNumber",
        label: "Batch Number",
        field_type: "text",
        required: false,
        max_length: null,
        options: null,
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: null,
        created_at: new Date("2026-07-27T15:54:08.027Z"),
        updated_at: null
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('ard_attributes', null, {});
  }
};
