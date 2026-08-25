'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('inv_test_methods', [
    {
      "id": 1,
      "test_name_id": 1,
      "method_name": "Visual Inspection",
      "is_active": true
    },
    {
      "id": 2,
      "test_name_id": 2,
      "method_name": "Potentiometric",
      "is_active": true
    },
    {
      "id": 3,
      "test_name_id": 3,
      "method_name": "UV Absorbance A280",
      "is_active": true
    },
    {
      "id": 4,
      "test_name_id": 3,
      "method_name": "BCA Assay",
      "is_active": true
    },
    {
      "id": 5,
      "test_name_id": 3,
      "method_name": "Bradford Assay",
      "is_active": true
    },
    {
      "id": 6,
      "test_name_id": 4,
      "method_name": "SEC-HPLC",
      "is_active": true
    },
    {
      "id": 7,
      "test_name_id": 5,
      "method_name": "CE-SDS (Reduced)",
      "is_active": true
    },
    {
      "id": 8,
      "test_name_id": 5,
      "method_name": "CE-SDS (Non-Reduced)",
      "is_active": true
    },
    {
      "id": 9,
      "test_name_id": 6,
      "method_name": "Dynamic Light Scattering",
      "is_active": true
    },
    {
      "id": 10,
      "test_name_id": 7,
      "method_name": "LAL Kinetic Turbidimetric",
      "is_active": true
    },
    {
      "id": 11,
      "test_name_id": 7,
      "method_name": "LAL Gel-Clot",
      "is_active": true
    },
    {
      "id": 12,
      "test_name_id": 8,
      "method_name": "Membrane Filtration",
      "is_active": true
    },
    {
      "id": 13,
      "test_name_id": 8,
      "method_name": "Direct Inoculation",
      "is_active": true
    },
    {
      "id": 14,
      "test_name_id": 9,
      "method_name": "Freezing Point Depression",
      "is_active": true
    },
    {
      "id": 15,
      "test_name_id": 10,
      "method_name": "Membrane Filtration",
      "is_active": true
    },
    {
      "id": 16,
      "test_name_id": 11,
      "method_name": "LC-MS/MS Peptide Mapping",
      "is_active": true
    },
    {
      "id": 17,
      "test_name_id": 12,
      "method_name": "ELISA",
      "is_active": true
    },
    {
      "id": 18,
      "test_name_id": 12,
      "method_name": "SPR (Surface Plasmon Resonance)",
      "is_active": true
    },
    {
      "id": 19,
      "test_name_id": 12,
      "method_name": "Cell-Based Assay",
      "is_active": true
    },
    {
      "id": 20,
      "test_name_id": 13,
      "method_name": "LC-MS Glycan Analysis",
      "is_active": true
    },
    {
      "id": 21,
      "test_name_id": 13,
      "method_name": "HILIC-HPLC",
      "is_active": true
    },
    {
      "id": 22,
      "test_name_id": 14,
      "method_name": "MFI (Micro-Flow Imaging)",
      "is_active": true
    },
    {
      "id": 23,
      "test_name_id": 14,
      "method_name": "Light Obscuration",
      "is_active": true
    },
    {
      "id": 24,
      "test_name_id": 15,
      "method_name": "ELISA",
      "is_active": true
    },
    {
      "id": 25,
      "test_name_id": 16,
      "method_name": "Visual Inspection",
      "is_active": true
    },
    {
      "id": 26,
      "test_name_id": 17,
      "method_name": "¹H NMR",
      "is_active": true
    },
    {
      "id": 27,
      "test_name_id": 17,
      "method_name": "¹³C NMR",
      "is_active": true
    },
    {
      "id": 28,
      "test_name_id": 18,
      "method_name": "ESI-MS",
      "is_active": true
    },
    {
      "id": 29,
      "test_name_id": 18,
      "method_name": "MALDI-TOF",
      "is_active": true
    },
    {
      "id": 30,
      "test_name_id": 19,
      "method_name": "RP-HPLC",
      "is_active": true
    },
    {
      "id": 31,
      "test_name_id": 19,
      "method_name": "HILIC-HPLC",
      "is_active": true
    },
    {
      "id": 32,
      "test_name_id": 20,
      "method_name": "UV-Vis Spectrophotometry",
      "is_active": true
    },
    {
      "id": 33,
      "test_name_id": 20,
      "method_name": "HPLC Area %",
      "is_active": true
    },
    {
      "id": 34,
      "test_name_id": 21,
      "method_name": "Karl Fischer Titration",
      "is_active": true
    },
    {
      "id": 35,
      "test_name_id": 22,
      "method_name": "GC Headspace",
      "is_active": true
    },
    {
      "id": 36,
      "test_name_id": 23,
      "method_name": "ICP-MS",
      "is_active": true
    },
    {
      "id": 37,
      "test_name_id": 24,
      "method_name": "Potentiometric",
      "is_active": true
    },
    {
      "id": 38,
      "test_name_id": 25,
      "method_name": "Nephelometry",
      "is_active": true
    },
    {
      "id": 39,
      "test_name_id": 25,
      "method_name": "Kinetic Solubility",
      "is_active": true
    },
    {
      "id": 40,
      "test_name_id": 26,
      "method_name": "UV-Vis",
      "is_active": true
    },
    {
      "id": 41,
      "test_name_id": 26,
      "method_name": "RP-HPLC",
      "is_active": true
    },
    {
      "id": 42,
      "test_name_id": 27,
      "method_name": "Forced Degradation RP-HPLC",
      "is_active": true
    },
    {
      "id": 43,
      "test_name_id": 28,
      "method_name": "Visual Inspection",
      "is_active": true
    },
    {
      "id": 44,
      "test_name_id": 29,
      "method_name": "Potentiometric",
      "is_active": true
    },
    {
      "id": 45,
      "test_name_id": 30,
      "method_name": "UV Absorbance A280",
      "is_active": true
    },
    {
      "id": 46,
      "test_name_id": 30,
      "method_name": "BCA Assay",
      "is_active": true
    },
    {
      "id": 47,
      "test_name_id": 30,
      "method_name": "Bradford Assay",
      "is_active": true
    },
    {
      "id": 48,
      "test_name_id": 31,
      "method_name": "SEC-HPLC",
      "is_active": true
    },
    {
      "id": 49,
      "test_name_id": 32,
      "method_name": "CE-SDS (Reduced)",
      "is_active": true
    },
    {
      "id": 50,
      "test_name_id": 32,
      "method_name": "CE-SDS (Non-Reduced)",
      "is_active": true
    },
    {
      "id": 51,
      "test_name_id": 33,
      "method_name": "Dynamic Light Scattering",
      "is_active": true
    },
    {
      "id": 52,
      "test_name_id": 34,
      "method_name": "LAL Kinetic Turbidimetric",
      "is_active": true
    },
    {
      "id": 53,
      "test_name_id": 34,
      "method_name": "LAL Gel-Clot",
      "is_active": true
    },
    {
      "id": 54,
      "test_name_id": 35,
      "method_name": "Membrane Filtration",
      "is_active": true
    },
    {
      "id": 55,
      "test_name_id": 35,
      "method_name": "Direct Inoculation",
      "is_active": true
    },
    {
      "id": 56,
      "test_name_id": 36,
      "method_name": "Freezing Point Depression",
      "is_active": true
    },
    {
      "id": 57,
      "test_name_id": 37,
      "method_name": "Membrane Filtration",
      "is_active": true
    },
    {
      "id": 58,
      "test_name_id": 38,
      "method_name": "LC-MS/MS Peptide Mapping",
      "is_active": true
    },
    {
      "id": 59,
      "test_name_id": 39,
      "method_name": "ELISA",
      "is_active": true
    },
    {
      "id": 60,
      "test_name_id": 39,
      "method_name": "SPR (Surface Plasmon Resonance)",
      "is_active": true
    },
    {
      "id": 61,
      "test_name_id": 39,
      "method_name": "Cell-Based Assay",
      "is_active": true
    },
    {
      "id": 62,
      "test_name_id": 40,
      "method_name": "LC-MS Glycan Analysis",
      "is_active": true
    },
    {
      "id": 63,
      "test_name_id": 40,
      "method_name": "HILIC-HPLC",
      "is_active": true
    },
    {
      "id": 64,
      "test_name_id": 41,
      "method_name": "MFI (Micro-Flow Imaging)",
      "is_active": true
    },
    {
      "id": 65,
      "test_name_id": 41,
      "method_name": "Light Obscuration",
      "is_active": true
    },
    {
      "id": 66,
      "test_name_id": 42,
      "method_name": "ELISA",
      "is_active": true
    },
    {
      "id": 67,
      "test_name_id": 43,
      "method_name": "Visual Inspection",
      "is_active": true
    },
    {
      "id": 68,
      "test_name_id": 44,
      "method_name": "¹H NMR",
      "is_active": true
    },
    {
      "id": 69,
      "test_name_id": 44,
      "method_name": "¹³C NMR",
      "is_active": true
    },
    {
      "id": 70,
      "test_name_id": 45,
      "method_name": "ESI-MS",
      "is_active": true
    },
    {
      "id": 71,
      "test_name_id": 45,
      "method_name": "MALDI-TOF",
      "is_active": true
    },
    {
      "id": 72,
      "test_name_id": 46,
      "method_name": "RP-HPLC",
      "is_active": true
    },
    {
      "id": 73,
      "test_name_id": 46,
      "method_name": "HILIC-HPLC",
      "is_active": true
    },
    {
      "id": 74,
      "test_name_id": 47,
      "method_name": "UV-Vis Spectrophotometry",
      "is_active": true
    },
    {
      "id": 75,
      "test_name_id": 47,
      "method_name": "HPLC Area %",
      "is_active": true
    },
    {
      "id": 76,
      "test_name_id": 48,
      "method_name": "Karl Fischer Titration",
      "is_active": true
    },
    {
      "id": 77,
      "test_name_id": 49,
      "method_name": "GC Headspace",
      "is_active": true
    },
    {
      "id": 78,
      "test_name_id": 50,
      "method_name": "ICP-MS",
      "is_active": true
    },
    {
      "id": 79,
      "test_name_id": 51,
      "method_name": "Potentiometric",
      "is_active": true
    },
    {
      "id": 80,
      "test_name_id": 52,
      "method_name": "Nephelometry",
      "is_active": true
    },
    {
      "id": 81,
      "test_name_id": 52,
      "method_name": "Kinetic Solubility",
      "is_active": true
    },
    {
      "id": 82,
      "test_name_id": 53,
      "method_name": "UV-Vis",
      "is_active": true
    },
    {
      "id": 83,
      "test_name_id": 53,
      "method_name": "RP-HPLC",
      "is_active": true
    },
    {
      "id": 84,
      "test_name_id": 54,
      "method_name": "Forced Degradation RP-HPLC",
      "is_active": true
    }
  ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('inv_test_methods', null, {});
  },
};
