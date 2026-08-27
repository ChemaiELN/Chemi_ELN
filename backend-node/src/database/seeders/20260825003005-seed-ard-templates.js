'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('ard_templates', [
      {
        id: "ac781f6d-7d04-40dd-9731-c1742205f4e6",
        family_id: "ac781f6d-7d04-40dd-9731-c1742205f4e6",
        name: "Standard Assay",
        template_type: "Assay",
        version: 1,
        status: "PUBLISHED",
        description: null,
        review_remarks: null,
        remarks: null,
        approved_by: "ad.hod",
        approved_on: "2026-07-28",
        created_by_id: "5e34985b-5fed-4a76-88ed-0fadda403882",
        sections: "[{\"id\":\"b80a05de-8f16-4a64-9f7d-6197aea88ebf\",\"title\":\"Objective\",\"type\":\"richtext\"},{\"id\":\"e76c361b-413c-4416-b9bf-959bd67fede3\",\"title\":\"Test Parameters\",\"type\":\"params\"},{\"id\":\"b06258a5-3e32-444d-9557-eb4a16790d6e\",\"title\":\"Results\",\"type\":\"table\",\"columns\":[{\"key\":\"sample\",\"label\":\"Sample\"},{\"key\":\"result\",\"label\":\"Result\"},{\"key\":\"spec\",\"label\":\"Spec\"}]}]",
        created_at: new Date("2026-07-28T00:03:06.744Z"),
        updated_at: new Date("2026-07-28T00:19:38.338Z"),
        dept_id: null,
        activation_date: null,
        last_updated_by: null,
        last_updated_by_id: null,
        include_weighing: false,
        include_ph: false,
        include_chemicals: false,
        include_sample_details: false,
        include_equipment: false,
        include_column: false,
        include_attachments: false,
        include_results: false,
        include_conclusion: false,
        include_cds_report: false,
        code: null
      },
      {
        id: "dd9ea9ff-d9f9-4ae3-89ff-f95ae35ba7be",
        family_id: "dd9ea9ff-d9f9-4ae3-89ff-f95ae35ba7be",
        name: "th",
        template_type: null,
        version: 1,
        status: "DRAFT",
        description: null,
        review_remarks: null,
        remarks: null,
        approved_by: null,
        approved_on: null,
        created_by_id: "418b7dc7-d0f0-4245-84c8-af47c564ff3c",
        sections: "[{\"id\":\"sec-msx477ev\",\"type\":\"richtext\",\"title\":\"Objective\",\"sequence\":1,\"required\":true}]",
        created_at: new Date("2026-08-17T10:52:34.079Z"),
        updated_at: new Date("2026-08-24T10:10:08.236Z"),
        dept_id: null,
        activation_date: null,
        last_updated_by: "ad.hod",
        last_updated_by_id: "5e34985b-5fed-4a76-88ed-0fadda403882",
        include_weighing: false,
        include_ph: false,
        include_chemicals: false,
        include_sample_details: false,
        include_equipment: false,
        include_column: false,
        include_attachments: false,
        include_results: false,
        include_conclusion: false,
        include_cds_report: false,
        code: null
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('ard_templates', null, {});
  }
};
