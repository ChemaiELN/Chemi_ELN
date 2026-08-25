'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('ard_form_types', [
      {
        id: "549af4cd-8fd5-4bcf-b5cc-28fbf7254f58",
        code: "STANDARD_ATR",
        name: "Standard ATR",
        description: "",
        attribute_links: "[{\"attributeId\":\"ca282fb2-efa8-487a-b654-89276720d1f4\",\"sequence\":0,\"requiredOverride\":null,\"displayInReport\":true}]",
        test_group_ids: "[]",
        mandate_certification: false,
        mandate_batch_no: false,
        mandate_sample_qty: false,
        mandate_qa_submission: false,
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: null,
        created_at: new Date("2026-07-27T15:54:59.421Z"),
        updated_at: null,
        category: null,
        allow_post_approval_changes: false
      },
      {
        id: "9b58a93f-93ab-4a25-aae9-42e2f1a32a9d",
        code: "MORNING",
        name: "morning",
        description: "",
        attribute_links: "[{\"attributeId\":\"4959b701-8f3d-4f7a-ae84-569fd218b299\",\"sequence\":0,\"requiredOverride\":null,\"displayInReport\":true}]",
        test_group_ids: "[\"ff3218ee-db47-453e-9d41-340d644f683e\",\"b850b0ce-5c28-4804-93f7-d02b6b88bfa5\"]",
        mandate_certification: false,
        mandate_batch_no: true,
        mandate_sample_qty: false,
        mandate_qa_submission: true,
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: null,
        created_at: new Date("2026-07-31T05:14:15.108Z"),
        updated_at: null,
        category: null,
        allow_post_approval_changes: false
      },
      {
        id: "c8ab85fd-2766-46cb-a308-76a5bfdef5b9",
        code: "ANTIBODY_MATERIAL",
        name: "antibody_material",
        description: "",
        attribute_links: "[{\"attributeId\":\"4959b701-8f3d-4f7a-ae84-569fd218b299\",\"sequence\":0,\"requiredOverride\":false,\"displayInReport\":true}]",
        test_group_ids: "[\"b2f0f4bd-631d-4f88-82c4-5e705741c24b\"]",
        mandate_certification: true,
        mandate_batch_no: false,
        mandate_sample_qty: false,
        mandate_qa_submission: false,
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: null,
        created_at: new Date("2026-08-24T07:11:59.586Z"),
        updated_at: new Date("2026-08-24T07:11:59.586Z"),
        category: null,
        allow_post_approval_changes: false
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('ard_form_types', null, {});
  }
};
