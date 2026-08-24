'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'title', { type: Sequelize.STRING(20), allowNull: true })
    await queryInterface.addColumn('users', 'first_name', { type: Sequelize.STRING(100), allowNull: true })
    await queryInterface.addColumn('users', 'middle_initials', { type: Sequelize.STRING(20), allowNull: true })
    await queryInterface.addColumn('users', 'last_name', { type: Sequelize.STRING(100), allowNull: true })
    await queryInterface.addColumn('users', 'display_name', { type: Sequelize.STRING(150), allowNull: true, unique: true })
    await queryInterface.addColumn('users', 'designation', { type: Sequelize.STRING(150), allowNull: true })
    await queryInterface.addColumn('users', 'contact_no', { type: Sequelize.STRING(30), allowNull: true })
    await queryInterface.addColumn('users', 'job_description_file', { type: Sequelize.STRING(255), allowNull: true })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'title')
    await queryInterface.removeColumn('users', 'first_name')
    await queryInterface.removeColumn('users', 'middle_initials')
    await queryInterface.removeColumn('users', 'last_name')
    await queryInterface.removeColumn('users', 'display_name')
    await queryInterface.removeColumn('users', 'designation')
    await queryInterface.removeColumn('users', 'contact_no')
    await queryInterface.removeColumn('users', 'job_description_file')
  },
}
