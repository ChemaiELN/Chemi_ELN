'use strict'

// Restores a fixed-inclusion flag that old had (Experiment Parameters is a
// hardcoded, application-rendered block used by every template — same
// pattern as the existing include_weighing/include_attachments/etc. flags —
// not something authored per-template via the Section library.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ard_templates', 'include_experiment_parameters', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    })
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ard_templates', 'include_experiment_parameters')
  },
}
