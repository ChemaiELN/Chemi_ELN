'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('ard_test_group_members', [
      {
        id: "0a0bce5a-e157-4cad-9bb7-cd576972339b",
        test_group_id: "ff3218ee-db47-453e-9d41-340d644f683e",
        test_configuration_id: "dd3e62d5-0666-401e-8cdc-e538a24d1efb",
        spec_overrides: "{}"
      },
      {
        id: "16fc873a-1d97-4d37-a835-2a578bd010d3",
        test_group_id: "b2f0f4bd-631d-4f88-82c4-5e705741c24b",
        test_configuration_id: "dd3e62d5-0666-401e-8cdc-e538a24d1efb",
        spec_overrides: "{}"
      },
      {
        id: "5dfcdf4f-eb45-416d-a53a-8e1f918ade2e",
        test_group_id: "b2f0f4bd-631d-4f88-82c4-5e705741c24b",
        test_configuration_id: "a9064c7d-f36c-4501-b2e1-5f3c0254c6d4",
        spec_overrides: "{}"
      },
      {
        id: "81f62c8d-4c22-44df-9006-0a0fac4ac961",
        test_group_id: "b850b0ce-5c28-4804-93f7-d02b6b88bfa5",
        test_configuration_id: "dd3e62d5-0666-401e-8cdc-e538a24d1efb",
        spec_overrides: "{}"
      },
      {
        id: "85487f72-1c0a-4bba-86c9-21c6d967c2d4",
        test_group_id: "ff3218ee-db47-453e-9d41-340d644f683e",
        test_configuration_id: "be691646-56ff-4fa2-9e1c-ccf01583de25",
        spec_overrides: "{}"
      },
      {
        id: "b211d45d-64cb-49db-a9be-42ef327ac8db",
        test_group_id: "b2f0f4bd-631d-4f88-82c4-5e705741c24b",
        test_configuration_id: "baca4fa9-d9c3-4a5c-9e60-6a9876a88bc1",
        spec_overrides: "{}"
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('ard_test_group_members', null, {});
  }
};
