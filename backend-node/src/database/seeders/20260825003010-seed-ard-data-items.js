'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('ard_data_items', [
      {
        id: "4b201703-d04a-4c1f-b9a7-4c2c20d35590",
        name: "value",
        data_type: "TEXT",
        uom: null,
        description: "abc",
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: null,
        created_at: new Date("2026-08-24T10:05:45.918Z"),
        updated_at: new Date("2026-08-24T10:05:45.918Z"),
        length_category: "LONG",
        lov_lookup_type: null
      },
      {
        id: "aa4f76ea-26ce-45bc-853a-86590b2655b6",
        name: "IPO",
        data_type: "DATE",
        uom: null,
        description: "",
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: null,
        created_at: new Date("2026-08-24T10:06:24.803Z"),
        updated_at: new Date("2026-08-24T10:06:24.803Z"),
        length_category: "SHORT",
        lov_lookup_type: null
      },
      {
        id: "aec7861f-d104-4470-9551-aa14dbb9de83",
        name: "key value",
        data_type: "INTEGER",
        uom: null,
        description: "rty",
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: null,
        created_at: new Date("2026-08-24T10:06:08.869Z"),
        updated_at: new Date("2026-08-24T10:06:08.869Z"),
        length_category: "SHORT",
        lov_lookup_type: null
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('ard_data_items', null, {});
  }
};
