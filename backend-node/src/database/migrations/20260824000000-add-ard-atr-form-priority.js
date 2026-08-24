'use strict'

// ArdAtrForm.priority has been declared on the Sequelize model since before
// today's ARD merge, but the column was never actually migrated into
// ard_atr_forms — any query selecting it (e.g. the test list's atrForm
// include) fails with "column ... priority does not exist". Adding it here
// to match the model, which the ArdTestExecutePage Priority field relies on.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('ard_atr_forms')
    if (!table.priority) {
      await queryInterface.addColumn('ard_atr_forms', 'priority', {
        type: Sequelize.STRING,
        allowNull: true,
      })
    }
  },
  async down(queryInterface) {
    const table = await queryInterface.describeTable('ard_atr_forms')
    if (table.priority) {
      await queryInterface.removeColumn('ard_atr_forms', 'priority')
    }
  },
}
