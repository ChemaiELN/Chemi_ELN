'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('inv_test_names', [
    {
      "id": 1,
      "test_type_id": 1,
      "name": "Appearance",
      "is_active": true
    },
    {
      "id": 2,
      "test_type_id": 1,
      "name": "pH",
      "is_active": true
    },
    {
      "id": 3,
      "test_type_id": 1,
      "name": "Protein Concentration",
      "is_active": true
    },
    {
      "id": 4,
      "test_type_id": 1,
      "name": "Purity (SE-HPLC)",
      "is_active": true
    },
    {
      "id": 5,
      "test_type_id": 1,
      "name": "Purity (CE-SDS)",
      "is_active": true
    },
    {
      "id": 6,
      "test_type_id": 1,
      "name": "Aggregation (DLS)",
      "is_active": true
    },
    {
      "id": 7,
      "test_type_id": 1,
      "name": "Endotoxin",
      "is_active": true
    },
    {
      "id": 8,
      "test_type_id": 1,
      "name": "Sterility",
      "is_active": true
    },
    {
      "id": 9,
      "test_type_id": 1,
      "name": "Osmolality",
      "is_active": true
    },
    {
      "id": 10,
      "test_type_id": 1,
      "name": "Bioburden",
      "is_active": true
    },
    {
      "id": 11,
      "test_type_id": 1,
      "name": "Identity (Peptide Map)",
      "is_active": true
    },
    {
      "id": 12,
      "test_type_id": 1,
      "name": "Potency / Binding",
      "is_active": true
    },
    {
      "id": 13,
      "test_type_id": 1,
      "name": "Glycosylation",
      "is_active": true
    },
    {
      "id": 14,
      "test_type_id": 1,
      "name": "Sub-visible Particles",
      "is_active": true
    },
    {
      "id": 15,
      "test_type_id": 1,
      "name": "Residual Protein A",
      "is_active": true
    },
    {
      "id": 16,
      "test_type_id": 2,
      "name": "Appearance",
      "is_active": true
    },
    {
      "id": 17,
      "test_type_id": 2,
      "name": "Identity (NMR)",
      "is_active": true
    },
    {
      "id": 18,
      "test_type_id": 2,
      "name": "Identity (MS)",
      "is_active": true
    },
    {
      "id": 19,
      "test_type_id": 2,
      "name": "Purity (HPLC)",
      "is_active": true
    },
    {
      "id": 20,
      "test_type_id": 2,
      "name": "Assay / Potency",
      "is_active": true
    },
    {
      "id": 21,
      "test_type_id": 2,
      "name": "Water Content",
      "is_active": true
    },
    {
      "id": 22,
      "test_type_id": 2,
      "name": "Residual Solvents",
      "is_active": true
    },
    {
      "id": 23,
      "test_type_id": 2,
      "name": "Heavy Metals",
      "is_active": true
    },
    {
      "id": 24,
      "test_type_id": 2,
      "name": "pH (Solution)",
      "is_active": true
    },
    {
      "id": 25,
      "test_type_id": 2,
      "name": "Solubility",
      "is_active": true
    },
    {
      "id": 26,
      "test_type_id": 2,
      "name": "Drug-to-Linker Ratio",
      "is_active": true
    },
    {
      "id": 27,
      "test_type_id": 2,
      "name": "Stability Indicating",
      "is_active": true
    },
    {
      "id": 28,
      "test_type_id": 3,
      "name": "Appearance",
      "is_active": true
    },
    {
      "id": 29,
      "test_type_id": 3,
      "name": "pH",
      "is_active": true
    },
    {
      "id": 30,
      "test_type_id": 3,
      "name": "Protein Concentration",
      "is_active": true
    },
    {
      "id": 31,
      "test_type_id": 3,
      "name": "Purity (SE-HPLC)",
      "is_active": true
    },
    {
      "id": 32,
      "test_type_id": 3,
      "name": "Purity (CE-SDS)",
      "is_active": true
    },
    {
      "id": 33,
      "test_type_id": 3,
      "name": "Aggregation (DLS)",
      "is_active": true
    },
    {
      "id": 34,
      "test_type_id": 3,
      "name": "Endotoxin",
      "is_active": true
    },
    {
      "id": 35,
      "test_type_id": 3,
      "name": "Sterility",
      "is_active": true
    },
    {
      "id": 36,
      "test_type_id": 3,
      "name": "Osmolality",
      "is_active": true
    },
    {
      "id": 37,
      "test_type_id": 3,
      "name": "Bioburden",
      "is_active": true
    },
    {
      "id": 38,
      "test_type_id": 3,
      "name": "Identity (Peptide Map)",
      "is_active": true
    },
    {
      "id": 39,
      "test_type_id": 3,
      "name": "Potency / Binding",
      "is_active": true
    },
    {
      "id": 40,
      "test_type_id": 3,
      "name": "Glycosylation",
      "is_active": true
    },
    {
      "id": 41,
      "test_type_id": 3,
      "name": "Sub-visible Particles",
      "is_active": true
    },
    {
      "id": 42,
      "test_type_id": 3,
      "name": "Residual Protein A",
      "is_active": true
    },
    {
      "id": 43,
      "test_type_id": 4,
      "name": "Appearance",
      "is_active": true
    },
    {
      "id": 44,
      "test_type_id": 4,
      "name": "Identity (NMR)",
      "is_active": true
    },
    {
      "id": 45,
      "test_type_id": 4,
      "name": "Identity (MS)",
      "is_active": true
    },
    {
      "id": 46,
      "test_type_id": 4,
      "name": "Purity (HPLC)",
      "is_active": true
    },
    {
      "id": 47,
      "test_type_id": 4,
      "name": "Assay / Potency",
      "is_active": true
    },
    {
      "id": 48,
      "test_type_id": 4,
      "name": "Water Content",
      "is_active": true
    },
    {
      "id": 49,
      "test_type_id": 4,
      "name": "Residual Solvents",
      "is_active": true
    },
    {
      "id": 50,
      "test_type_id": 4,
      "name": "Heavy Metals",
      "is_active": true
    },
    {
      "id": 51,
      "test_type_id": 4,
      "name": "pH (Solution)",
      "is_active": true
    },
    {
      "id": 52,
      "test_type_id": 4,
      "name": "Solubility",
      "is_active": true
    },
    {
      "id": 53,
      "test_type_id": 4,
      "name": "Drug-to-Linker Ratio",
      "is_active": true
    },
    {
      "id": 54,
      "test_type_id": 4,
      "name": "Stability Indicating",
      "is_active": true
    }
  ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('inv_test_names', null, {});
  },
};
