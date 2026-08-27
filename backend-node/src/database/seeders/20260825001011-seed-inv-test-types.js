'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('inv_test_types', [
    {
      "id": 1,
      "type_key": "antibody",
      "name": "TEST - Antibody",
      "is_active": true
    },
    {
      "id": 2,
      "type_key": "linker_payload",
      "name": "TEST - Linker Payload",
      "is_active": true
    },
    {
      "id": 3,
      "type_key": "TEST_ANTIBODY",
      "name": "TEST - Antibody",
      "is_active": true
    },
    {
      "id": 4,
      "type_key": "TEST_LINKER_PAYLOAD",
      "name": "TEST - Linker Payload",
      "is_active": true
    },
    {
      "id": 5,
      "type_key": "test_type_e3907",
      "name": "Updated by smoke test",
      "is_active": true
    },
    {
      "id": 6,
      "type_key": "test_type_e1854",
      "name": "Updated by smoke test",
      "is_active": true
    }
  ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('inv_test_types', null, {});
  },
};
