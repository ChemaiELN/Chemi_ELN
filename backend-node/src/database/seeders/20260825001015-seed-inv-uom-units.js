'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('inv_uom_units', [
    {
      "id": 1,
      "dimension_id": 1,
      "symbol": "L",
      "name": "Litre",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 2,
      "dimension_id": 1,
      "symbol": "mL",
      "name": "Millilitre",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "0.001000000000"
    },
    {
      "id": 3,
      "dimension_id": 1,
      "symbol": "µL",
      "name": "Microlitre",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "0.000001000000"
    },
    {
      "id": 4,
      "dimension_id": 1,
      "symbol": "nL",
      "name": "Nanolitre",
      "sort_order": 3,
      "is_active": true,
      "factor_to_base": "0.000000001000"
    },
    {
      "id": 5,
      "dimension_id": 2,
      "symbol": "kg",
      "name": "Kilogram",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1000.000000000000"
    },
    {
      "id": 6,
      "dimension_id": 2,
      "symbol": "g",
      "name": "Gram",
      "sort_order": 1,
      "is_active": false,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 7,
      "dimension_id": 2,
      "symbol": "mg",
      "name": "Milligram",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "0.001000000000"
    },
    {
      "id": 8,
      "dimension_id": 2,
      "symbol": "µg",
      "name": "Microgram",
      "sort_order": 3,
      "is_active": true,
      "factor_to_base": "0.000001000000"
    },
    {
      "id": 9,
      "dimension_id": 2,
      "symbol": "ng",
      "name": "Nanogram",
      "sort_order": 4,
      "is_active": true,
      "factor_to_base": "0.000000001000"
    },
    {
      "id": 10,
      "dimension_id": 2,
      "symbol": "pg",
      "name": "Picogram",
      "sort_order": 5,
      "is_active": true,
      "factor_to_base": "0.000000000001"
    },
    {
      "id": 11,
      "dimension_id": 3,
      "symbol": "mol",
      "name": "Mole",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 12,
      "dimension_id": 3,
      "symbol": "mmol",
      "name": "Millimole",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 13,
      "dimension_id": 3,
      "symbol": "µmol",
      "name": "Micromole",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 14,
      "dimension_id": 3,
      "symbol": "nmol",
      "name": "Nanomole",
      "sort_order": 3,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 15,
      "dimension_id": 4,
      "symbol": "g/L",
      "name": "Gram per Litre",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 16,
      "dimension_id": 4,
      "symbol": "mg/L",
      "name": "Milligram per Litre",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 17,
      "dimension_id": 4,
      "symbol": "µg/L",
      "name": "Microgram per Litre",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 18,
      "dimension_id": 4,
      "symbol": "ng/L",
      "name": "Nanogram per Litre",
      "sort_order": 3,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 19,
      "dimension_id": 4,
      "symbol": "mg/mL",
      "name": "Milligram per mL",
      "sort_order": 4,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 20,
      "dimension_id": 4,
      "symbol": "µg/mL",
      "name": "Microgram per mL",
      "sort_order": 5,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 21,
      "dimension_id": 4,
      "symbol": "ng/mL",
      "name": "Nanogram per mL",
      "sort_order": 6,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 22,
      "dimension_id": 5,
      "symbol": "M",
      "name": "Molar",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 23,
      "dimension_id": 5,
      "symbol": "mM",
      "name": "Millimolar",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 24,
      "dimension_id": 5,
      "symbol": "µM",
      "name": "Micromolar",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 25,
      "dimension_id": 5,
      "symbol": "nM",
      "name": "Nanomolar",
      "sort_order": 3,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 26,
      "dimension_id": 6,
      "symbol": "%",
      "name": "Percent",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 27,
      "dimension_id": 6,
      "symbol": "%v/v",
      "name": "Percent v/v",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 28,
      "dimension_id": 6,
      "symbol": "%w/v",
      "name": "Percent w/v",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 29,
      "dimension_id": 6,
      "symbol": "%w/w",
      "name": "Percent w/w",
      "sort_order": 3,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 30,
      "dimension_id": 7,
      "symbol": "m",
      "name": "Metre",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 31,
      "dimension_id": 7,
      "symbol": "cm",
      "name": "Centimetre",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 32,
      "dimension_id": 7,
      "symbol": "mm",
      "name": "Millimetre",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 33,
      "dimension_id": 7,
      "symbol": "µm",
      "name": "Micrometre",
      "sort_order": 3,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 34,
      "dimension_id": 7,
      "symbol": "nm",
      "name": "Nanometre",
      "sort_order": 4,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 35,
      "dimension_id": 8,
      "symbol": "m²",
      "name": "Square Metre",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 36,
      "dimension_id": 8,
      "symbol": "cm²",
      "name": "Square Centimetre",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 37,
      "dimension_id": 8,
      "symbol": "mm²",
      "name": "Square Millimetre",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 38,
      "dimension_id": 9,
      "symbol": "°C",
      "name": "Degree Celsius",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 39,
      "dimension_id": 9,
      "symbol": "°F",
      "name": "Degree Fahrenheit",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 40,
      "dimension_id": 9,
      "symbol": "K",
      "name": "Kelvin",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 41,
      "dimension_id": 10,
      "symbol": "Pa",
      "name": "Pascal",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 42,
      "dimension_id": 10,
      "symbol": "kPa",
      "name": "Kilopascal",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 43,
      "dimension_id": 10,
      "symbol": "MPa",
      "name": "Megapascal",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 44,
      "dimension_id": 10,
      "symbol": "bar",
      "name": "Bar",
      "sort_order": 3,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 45,
      "dimension_id": 10,
      "symbol": "psi",
      "name": "PSI",
      "sort_order": 4,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 46,
      "dimension_id": 10,
      "symbol": "atm",
      "name": "Atmosphere",
      "sort_order": 5,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 47,
      "dimension_id": 11,
      "symbol": "s",
      "name": "Second",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 48,
      "dimension_id": 11,
      "symbol": "min",
      "name": "Minute",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 49,
      "dimension_id": 11,
      "symbol": "h",
      "name": "Hour",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 50,
      "dimension_id": 11,
      "symbol": "d",
      "name": "Day",
      "sort_order": 3,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 51,
      "dimension_id": 12,
      "symbol": "mL/min",
      "name": "Millilitre per Minute",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 52,
      "dimension_id": 12,
      "symbol": "µL/min",
      "name": "Microlitre per Minute",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 53,
      "dimension_id": 12,
      "symbol": "L/min",
      "name": "Litre per Minute",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 54,
      "dimension_id": 13,
      "symbol": "g/mL",
      "name": "Gram per mL",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 55,
      "dimension_id": 13,
      "symbol": "g/L",
      "name": "Gram per Litre",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 56,
      "dimension_id": 13,
      "symbol": "kg/m³",
      "name": "Kilogram per Cubic Metre",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 57,
      "dimension_id": 14,
      "symbol": "cP",
      "name": "Centipoise",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 58,
      "dimension_id": 14,
      "symbol": "mPa·s",
      "name": "Millipascal Second",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 59,
      "dimension_id": 15,
      "symbol": "pH",
      "name": "pH",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 60,
      "dimension_id": 16,
      "symbol": "U",
      "name": "Unit",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 61,
      "dimension_id": 16,
      "symbol": "mU",
      "name": "Milliunit",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 62,
      "dimension_id": 16,
      "symbol": "kU",
      "name": "Kilounit",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 63,
      "dimension_id": 16,
      "symbol": "U/mL",
      "name": "Units per mL",
      "sort_order": 3,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 64,
      "dimension_id": 16,
      "symbol": "U/mg",
      "name": "Units per mg",
      "sort_order": 4,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 65,
      "dimension_id": 17,
      "symbol": "U/mg",
      "name": "Units per Milligram",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 66,
      "dimension_id": 17,
      "symbol": "mU/mg",
      "name": "Milliunits per Milligram",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 67,
      "dimension_id": 18,
      "symbol": "%",
      "name": "Percent",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 68,
      "dimension_id": 19,
      "symbol": "AU",
      "name": "Absorbance Unit",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 69,
      "dimension_id": 19,
      "symbol": "mAU",
      "name": "Milli Absorbance Unit",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 70,
      "dimension_id": 20,
      "symbol": "nm",
      "name": "Nanometre",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 71,
      "dimension_id": 20,
      "symbol": "µm",
      "name": "Micrometre",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 72,
      "dimension_id": 21,
      "symbol": "Hz",
      "name": "Hertz",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 73,
      "dimension_id": 21,
      "symbol": "kHz",
      "name": "Kilohertz",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 74,
      "dimension_id": 21,
      "symbol": "MHz",
      "name": "Megahertz",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 75,
      "dimension_id": 22,
      "symbol": "rpm",
      "name": "Revolutions per Minute",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 76,
      "dimension_id": 22,
      "symbol": "g",
      "name": "Relative Centrifugal Force",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 77,
      "dimension_id": 23,
      "symbol": "W",
      "name": "Watt",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 78,
      "dimension_id": 23,
      "symbol": "mW",
      "name": "Milliwatt",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 79,
      "dimension_id": 23,
      "symbol": "µW",
      "name": "Microwatt",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 80,
      "dimension_id": 24,
      "symbol": "V",
      "name": "Volt",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 81,
      "dimension_id": 24,
      "symbol": "mV",
      "name": "Millivolt",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 82,
      "dimension_id": 24,
      "symbol": "kV",
      "name": "Kilovolt",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 83,
      "dimension_id": 25,
      "symbol": "A",
      "name": "Ampere",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 84,
      "dimension_id": 25,
      "symbol": "mA",
      "name": "Milliampere",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 85,
      "dimension_id": 25,
      "symbol": "µA",
      "name": "Microampere",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 86,
      "dimension_id": 26,
      "symbol": "mS/cm",
      "name": "Millisiemens per cm",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 87,
      "dimension_id": 26,
      "symbol": "µS/cm",
      "name": "Microsiemens per cm",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 88,
      "dimension_id": 26,
      "symbol": "S/m",
      "name": "Siemens per Metre",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 89,
      "dimension_id": 27,
      "symbol": "mOsm/kg",
      "name": "Milliosmole per kg",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 90,
      "dimension_id": 27,
      "symbol": "Osm/kg",
      "name": "Osmole per kg",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 91,
      "dimension_id": 28,
      "symbol": "nm",
      "name": "Nanometre",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 92,
      "dimension_id": 28,
      "symbol": "µm",
      "name": "Micrometre",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 93,
      "dimension_id": 28,
      "symbol": "mm",
      "name": "Millimetre",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 94,
      "dimension_id": 29,
      "symbol": "m²/g",
      "name": "Square Metre per Gram",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 95,
      "dimension_id": 29,
      "symbol": "cm²/g",
      "name": "Square Centimetre per Gram",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 96,
      "dimension_id": 30,
      "symbol": "units",
      "name": "Units",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 97,
      "dimension_id": 30,
      "symbol": "pcs",
      "name": "Pieces",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 98,
      "dimension_id": 30,
      "symbol": "vials",
      "name": "Vials",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 99,
      "dimension_id": 30,
      "symbol": "ampoules",
      "name": "Ampoules",
      "sort_order": 3,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 100,
      "dimension_id": 31,
      "symbol": "x",
      "name": "Fold",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 101,
      "dimension_id": 31,
      "symbol": "1:n",
      "name": "Ratio",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 102,
      "dimension_id": 32,
      "symbol": "v/v",
      "name": "Volume per Volume",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 103,
      "dimension_id": 32,
      "symbol": "w/v",
      "name": "Weight per Volume",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 104,
      "dimension_id": 32,
      "symbol": "w/w",
      "name": "Weight per Weight",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 105,
      "dimension_id": 33,
      "symbol": "IU",
      "name": "International Unit",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 106,
      "dimension_id": 33,
      "symbol": "mIU",
      "name": "Milli International Unit",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 107,
      "dimension_id": 33,
      "symbol": "IU/mL",
      "name": "IU per mL",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 108,
      "dimension_id": 34,
      "symbol": "CFU",
      "name": "Colony Forming Unit",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 109,
      "dimension_id": 34,
      "symbol": "CFU/mL",
      "name": "CFU per mL",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 110,
      "dimension_id": 35,
      "symbol": "EU",
      "name": "Endotoxin Unit",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 111,
      "dimension_id": 35,
      "symbol": "EU/mL",
      "name": "EU per mL",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 112,
      "dimension_id": 35,
      "symbol": "EU/mg",
      "name": "EU per mg",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 113,
      "dimension_id": 36,
      "symbol": "Bq",
      "name": "Becquerel",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 114,
      "dimension_id": 36,
      "symbol": "kBq",
      "name": "Kilobecquerel",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 115,
      "dimension_id": 36,
      "symbol": "MBq",
      "name": "Megabecquerel",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 116,
      "dimension_id": 36,
      "symbol": "Ci",
      "name": "Curie",
      "sort_order": 3,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 117,
      "dimension_id": 36,
      "symbol": "mCi",
      "name": "Millicurie",
      "sort_order": 4,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 118,
      "dimension_id": 37,
      "symbol": "N",
      "name": "Newton",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 119,
      "dimension_id": 37,
      "symbol": "mN",
      "name": "Millinewton",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 120,
      "dimension_id": 37,
      "symbol": "kN",
      "name": "Kilonewton",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 121,
      "dimension_id": 38,
      "symbol": "J",
      "name": "Joule",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 122,
      "dimension_id": 38,
      "symbol": "kJ",
      "name": "Kilojoule",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 123,
      "dimension_id": 38,
      "symbol": "cal",
      "name": "Calorie",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 124,
      "dimension_id": 38,
      "symbol": "kcal",
      "name": "Kilocalorie",
      "sort_order": 3,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 125,
      "dimension_id": 39,
      "symbol": "°",
      "name": "Degree",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 126,
      "dimension_id": 39,
      "symbol": "rad",
      "name": "Radian",
      "sort_order": 1,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 127,
      "dimension_id": 39,
      "symbol": "mrad",
      "name": "Milliradian",
      "sort_order": 2,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 128,
      "dimension_id": 41,
      "symbol": "tu622",
      "name": "Test Unit 361fa4",
      "sort_order": 2,
      "is_active": false,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 129,
      "dimension_id": 42,
      "symbol": "tu492",
      "name": "Test Unit 7ad10a",
      "sort_order": 2,
      "is_active": false,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 130,
      "dimension_id": 2,
      "symbol": "gm",
      "name": "Gram",
      "sort_order": 0,
      "is_active": true,
      "factor_to_base": "1.000000000000"
    },
    {
      "id": 131,
      "dimension_id": 7,
      "symbol": "Å",
      "name": "Angstrom",
      "sort_order": 5,
      "is_active": true,
      "factor_to_base": "0.000000000100"
    }
  ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('inv_uom_units', null, {});
  },
};
