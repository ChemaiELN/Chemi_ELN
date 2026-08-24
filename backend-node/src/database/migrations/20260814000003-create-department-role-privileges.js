'use strict'

// Per-(department, role) operation grants for module privileges (ADC first).
// Kept separate from `role_privileges` — that table's department_id is nullable,
// and a unique constraint over a nullable column is unreliable in Postgres
// (NULL != NULL), so departmental grants get their own NOT NULL composite key.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('department_role_privileges', {
      // No DB-level default — the Sequelize model supplies UUIDV4, matching the
      // convention of every other table in this schema.
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      department_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'departments', key: 'id' },
        onDelete: 'CASCADE',
      },
      role_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'roles', key: 'id' },
        onDelete: 'CASCADE',
      },
      privilege_key: { type: Sequelize.STRING(100), allowNull: false },
      is_granted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    })

    await queryInterface.addConstraint('department_role_privileges', {
      fields: ['department_id', 'role_id', 'privilege_key'],
      type: 'unique',
      name: 'department_role_privileges_dept_role_key_unique',
    })

    await queryInterface.addIndex('department_role_privileges', ['department_id', 'role_id'], {
      name: 'department_role_privileges_dept_role_idx',
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('department_role_privileges')
  },
}
