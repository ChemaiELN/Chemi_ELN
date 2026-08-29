'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP`,
    )
    await queryInterface.sequelize.query(
      `ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS enable_security_questions BOOLEAN NOT NULL DEFAULT true`,
    )

    await queryInterface.sequelize.query(
      `UPDATE users SET terms_accepted_at = NOW() WHERE terms_accepted_at IS NULL`,
    )

    const now = new Date()
    await queryInterface.sequelize.query(`
      INSERT INTO departments (id, code, name, description, is_active, created_by, created_at, updated_at)
      VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'IT', 'Administrator / IT Department', 'System administration and IT operations', true, NULL, :now, :now)
      ON CONFLICT (code) DO NOTHING
    `, { replacements: { now } })

    await queryInterface.sequelize.query(`
      INSERT INTO roles (id, code, name, description, is_active, created_at)
      VALUES ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'DQA', 'Department Quality Assurance', 'Cross-department QA access to all module data', true, :now)
      ON CONFLICT (code) DO NOTHING
    `, { replacements: { now } })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'terms_accepted_at')
    await queryInterface.removeColumn('global_settings', 'enable_security_questions')
    await queryInterface.bulkDelete('departments', { code: 'IT' })
    await queryInterface.bulkDelete('roles', { code: 'DQA' })
  },
}
