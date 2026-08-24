'use strict'

// emp_no, email, and role_id are no longer collected at user-creation time
// (emp_no is folded into username; role/department/lab are assigned later via
// Edit), so they can no longer be required at the DB level.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('users', 'emp_no', { type: Sequelize.STRING(50), allowNull: true, unique: true })
    await queryInterface.changeColumn('users', 'email', { type: Sequelize.STRING(255), allowNull: true, unique: true })
    await queryInterface.changeColumn('users', 'role_id', { type: Sequelize.UUID, allowNull: true })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('users', 'emp_no', { type: Sequelize.STRING(50), allowNull: false, unique: true })
    await queryInterface.changeColumn('users', 'email', { type: Sequelize.STRING(255), allowNull: false, unique: true })
    await queryInterface.changeColumn('users', 'role_id', { type: Sequelize.UUID, allowNull: false })
  },
}
