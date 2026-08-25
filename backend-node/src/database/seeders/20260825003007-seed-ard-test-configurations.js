'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('ard_test_configurations', [
      {
        id: "a9064c7d-f36c-4501-b2e1-5f3c0254c6d4",
        config_code: "TC-c6d4",
        technique_code: "ADC",
        technique_name: "Sodium",
        test_type: "HC",
        test_subtype: "HC by RF",
        result_params: "[{\"id\":\"p1787554530306\",\"name\":\"result\",\"dataType\":\"text\",\"validationType\":\"NONE\",\"paramType\":\"INPUT\"},{\"id\":\"p1787554543608\",\"name\":\"purity\",\"dataType\":\"number\",\"validationType\":\"RANGE\",\"paramType\":\"INPUT\",\"uom\":\"Milliliter\",\"lowerLimit\":12,\"upperLimit\":13}]",
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        created_at: new Date("2026-08-24T06:57:00.906Z"),
        updated_at: new Date("2026-08-24T07:02:46.749Z"),
        analysis_technical_code: "arf",
        method_reference: null
      },
      {
        id: "baca4fa9-d9c3-4a5c-9e60-6a9876a88bc1",
        config_code: "TC-5649",
        technique_code: "tech-001",
        technique_name: "assay",
        test_type: "assay",
        test_subtype: "assay by chiral",
        result_params: "[{\"id\":\"p1786093587005\",\"name\":\"viscosity\",\"dataType\":\"text\",\"uom\":null,\"lowerLimit\":null,\"upperLimit\":null,\"placeholder\":null,\"validationType\":\"NONE\",\"paramType\":\"INPUT\",\"formula\":null}]",
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: null,
        created_at: new Date("2026-08-07T09:06:40.376Z"),
        updated_at: new Date("2026-08-07T09:06:40.412Z"),
        analysis_technical_code: "ARN",
        method_reference: null
      },
      {
        id: "be691646-56ff-4fa2-9e1c-ccf01583de25",
        config_code: "TC-8085",
        technique_code: "tech-001",
        technique_name: "assay",
        test_type: "manu",
        test_subtype: "assay HPLC",
        result_params: "[{\"id\":\"p1785473217984\",\"name\":\"one\",\"dataType\":\"text\",\"uom\":null,\"lowerLimit\":null,\"upperLimit\":null,\"placeholder\":null,\"validationType\":\"NONE\",\"paramType\":\"INPUT\",\"formula\":null},{\"id\":\"p1785473268583\",\"name\":\"count\",\"dataType\":\"number\",\"uom\":null,\"lowerLimit\":null,\"upperLimit\":null,\"placeholder\":null,\"validationType\":\"NONE\",\"paramType\":\"INPUT\",\"formula\":null}]",
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        created_at: new Date("2026-07-31T04:48:13.204Z"),
        updated_at: new Date("2026-08-07T09:05:00.677Z"),
        analysis_technical_code: "ARN",
        method_reference: null
      },
      {
        id: "dd3e62d5-0666-401e-8cdc-e538a24d1efb",
        config_code: "TC-7531",
        technique_code: "HPLC",
        technique_name: "High Performance Liquid Chromatography",
        test_type: "Assay",
        test_subtype: "",
        result_params: "[{\"id\":\"p1785167093469\",\"name\":\"Puritynum\",\"dataType\":\"number\",\"uom\":null,\"lowerLimit\":95,\"upperLimit\":105,\"placeholder\":null,\"validationType\":\"RANGE\",\"paramType\":\"INPUT\",\"formula\":null}]",
        is_active: true,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: null,
        created_at: new Date("2026-07-27T15:52:32.877Z"),
        updated_at: new Date("2026-07-27T15:52:32.982Z"),
        analysis_technical_code: null,
        method_reference: null
      },
      {
        id: "ebe8e58d-c0bb-4cda-80db-6843f1ad1f4c",
        config_code: "TC-1f4c",
        technique_code: "tech-001",
        technique_name: "assay",
        test_type: "fc",
        test_subtype: "fc by rf",
        result_params: "[{\"id\":\"p1787554991366\",\"name\":\"pur\",\"dataType\":\"number\",\"validationType\":\"RANGE\",\"paramType\":\"INPUT\",\"uom\":\"Milliliter\",\"lowerLimit\":11,\"upperLimit\":12}]",
        is_active: false,
        created_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        updated_by: "5e34985b-5fed-4a76-88ed-0fadda403882",
        created_at: new Date("2026-08-24T07:03:37.623Z"),
        updated_at: new Date("2026-08-24T07:08:22.475Z"),
        analysis_technical_code: "fc",
        method_reference: null
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('ard_test_configurations', null, {});
  }
};
