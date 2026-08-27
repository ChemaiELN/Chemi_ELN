'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('inv_uom_dimensions', [
    {
      "id": 1,
      "dimension_key": "volume",
      "display_name": "Volume",
      "base_unit": "L",
      "sort_order": 0,
      "is_active": true
    },
    {
      "id": 2,
      "dimension_key": "mass",
      "display_name": "Mass",
      "base_unit": "g",
      "sort_order": 1,
      "is_active": true
    },
    {
      "id": 3,
      "dimension_key": "molar_amount",
      "display_name": "Molar Amount",
      "base_unit": "mol",
      "sort_order": 2,
      "is_active": true
    },
    {
      "id": 4,
      "dimension_key": "concentration",
      "display_name": "Concentration",
      "base_unit": "g/L",
      "sort_order": 3,
      "is_active": true
    },
    {
      "id": 5,
      "dimension_key": "molarity",
      "display_name": "Molarity",
      "base_unit": "M",
      "sort_order": 4,
      "is_active": true
    },
    {
      "id": 6,
      "dimension_key": "percentage",
      "display_name": "Percentage",
      "base_unit": "%",
      "sort_order": 5,
      "is_active": true
    },
    {
      "id": 7,
      "dimension_key": "length",
      "display_name": "Length",
      "base_unit": "m",
      "sort_order": 6,
      "is_active": true
    },
    {
      "id": 8,
      "dimension_key": "area",
      "display_name": "Area",
      "base_unit": "m²",
      "sort_order": 7,
      "is_active": true
    },
    {
      "id": 9,
      "dimension_key": "temperature",
      "display_name": "Temperature",
      "base_unit": "°C",
      "sort_order": 8,
      "is_active": true
    },
    {
      "id": 10,
      "dimension_key": "pressure",
      "display_name": "Pressure",
      "base_unit": "Pa",
      "sort_order": 9,
      "is_active": true
    },
    {
      "id": 11,
      "dimension_key": "time",
      "display_name": "Time",
      "base_unit": "s",
      "sort_order": 10,
      "is_active": true
    },
    {
      "id": 12,
      "dimension_key": "flow_rate",
      "display_name": "Flow Rate",
      "base_unit": "mL/min",
      "sort_order": 11,
      "is_active": true
    },
    {
      "id": 13,
      "dimension_key": "density",
      "display_name": "Density",
      "base_unit": "g/mL",
      "sort_order": 12,
      "is_active": true
    },
    {
      "id": 14,
      "dimension_key": "viscosity",
      "display_name": "Viscosity",
      "base_unit": "cP",
      "sort_order": 13,
      "is_active": true
    },
    {
      "id": 15,
      "dimension_key": "ph",
      "display_name": "pH",
      "base_unit": "pH",
      "sort_order": 14,
      "is_active": true
    },
    {
      "id": 16,
      "dimension_key": "activity",
      "display_name": "Enzymatic Activity",
      "base_unit": "U",
      "sort_order": 15,
      "is_active": true
    },
    {
      "id": 17,
      "dimension_key": "specific_activity",
      "display_name": "Specific Activity",
      "base_unit": "U/mg",
      "sort_order": 16,
      "is_active": true
    },
    {
      "id": 18,
      "dimension_key": "purity",
      "display_name": "Purity",
      "base_unit": "%",
      "sort_order": 17,
      "is_active": true
    },
    {
      "id": 19,
      "dimension_key": "absorbance",
      "display_name": "Absorbance",
      "base_unit": "AU",
      "sort_order": 18,
      "is_active": true
    },
    {
      "id": 20,
      "dimension_key": "wavelength",
      "display_name": "Wavelength",
      "base_unit": "nm",
      "sort_order": 19,
      "is_active": true
    },
    {
      "id": 21,
      "dimension_key": "frequency",
      "display_name": "Frequency",
      "base_unit": "Hz",
      "sort_order": 20,
      "is_active": true
    },
    {
      "id": 22,
      "dimension_key": "rotation_speed",
      "display_name": "Rotation Speed",
      "base_unit": "rpm",
      "sort_order": 21,
      "is_active": true
    },
    {
      "id": 23,
      "dimension_key": "power",
      "display_name": "Power",
      "base_unit": "W",
      "sort_order": 22,
      "is_active": true
    },
    {
      "id": 24,
      "dimension_key": "voltage",
      "display_name": "Voltage",
      "base_unit": "V",
      "sort_order": 23,
      "is_active": true
    },
    {
      "id": 25,
      "dimension_key": "current",
      "display_name": "Current",
      "base_unit": "A",
      "sort_order": 24,
      "is_active": true
    },
    {
      "id": 26,
      "dimension_key": "conductivity",
      "display_name": "Conductivity",
      "base_unit": "mS/cm",
      "sort_order": 25,
      "is_active": true
    },
    {
      "id": 27,
      "dimension_key": "osmolality",
      "display_name": "Osmolality",
      "base_unit": "mOsm/kg",
      "sort_order": 26,
      "is_active": true
    },
    {
      "id": 28,
      "dimension_key": "particle_size",
      "display_name": "Particle Size",
      "base_unit": "nm",
      "sort_order": 27,
      "is_active": true
    },
    {
      "id": 29,
      "dimension_key": "surface_area",
      "display_name": "Surface Area",
      "base_unit": "m²/g",
      "sort_order": 28,
      "is_active": true
    },
    {
      "id": 30,
      "dimension_key": "amount",
      "display_name": "Amount / Count",
      "base_unit": "units",
      "sort_order": 29,
      "is_active": true
    },
    {
      "id": 31,
      "dimension_key": "dilution",
      "display_name": "Dilution Factor",
      "base_unit": "x",
      "sort_order": 30,
      "is_active": true
    },
    {
      "id": 32,
      "dimension_key": "ratio",
      "display_name": "Ratio",
      "base_unit": "",
      "sort_order": 31,
      "is_active": true
    },
    {
      "id": 33,
      "dimension_key": "iu",
      "display_name": "International Units",
      "base_unit": "IU",
      "sort_order": 32,
      "is_active": true
    },
    {
      "id": 34,
      "dimension_key": "colony_units",
      "display_name": "Colony Forming Units",
      "base_unit": "CFU",
      "sort_order": 33,
      "is_active": true
    },
    {
      "id": 35,
      "dimension_key": "endotoxin",
      "display_name": "Endotoxin",
      "base_unit": "EU",
      "sort_order": 34,
      "is_active": true
    },
    {
      "id": 36,
      "dimension_key": "radiation",
      "display_name": "Radioactivity",
      "base_unit": "Bq",
      "sort_order": 35,
      "is_active": true
    },
    {
      "id": 37,
      "dimension_key": "force",
      "display_name": "Force",
      "base_unit": "N",
      "sort_order": 36,
      "is_active": true
    },
    {
      "id": 38,
      "dimension_key": "energy",
      "display_name": "Energy",
      "base_unit": "J",
      "sort_order": 37,
      "is_active": true
    },
    {
      "id": 39,
      "dimension_key": "angle",
      "display_name": "Angle",
      "base_unit": "°",
      "sort_order": 38,
      "is_active": true
    },
    {
      "id": 40,
      "dimension_key": "custom",
      "display_name": "Custom / Other",
      "base_unit": "",
      "sort_order": 39,
      "is_active": true
    },
    {
      "id": 41,
      "dimension_key": "test_dim_242ce",
      "display_name": "Test Dimension b8a264",
      "base_unit": "unit",
      "sort_order": 10,
      "is_active": false
    },
    {
      "id": 42,
      "dimension_key": "test_dim_26b59",
      "display_name": "Test Dimension 57fd84",
      "base_unit": "unit",
      "sort_order": 10,
      "is_active": false
    }
  ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('inv_uom_dimensions', null, {});
  },
};
