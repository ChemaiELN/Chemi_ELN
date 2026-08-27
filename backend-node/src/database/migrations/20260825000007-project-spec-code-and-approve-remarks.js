'use strict'

// The specification number is a formal, GxP-significant identifier that
// should only exist once a spec has actually been approved — assigning it
// at creation made every abandoned draft consume a number. spec_code is now
// nullable and left blank until /approve generates it. approve_remarks
// mirrors submit_remarks, recorded alongside the e-signature at approval.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('ard_project_specifications', 'spec_code', {
      type: Sequelize.STRING(50),
      allowNull: true,
    })
    await queryInterface.addColumn('ard_project_specifications', 'approve_remarks', {
      type: Sequelize.TEXT,
      allowNull: true,
    })
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('ard_project_specifications', 'spec_code', {
      type: Sequelize.STRING(50),
      allowNull: false,
    })
    await queryInterface.removeColumn('ard_project_specifications', 'approve_remarks')
  },
}
