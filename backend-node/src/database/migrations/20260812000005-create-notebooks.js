'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notebooks', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      title: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.STRING(1000), allowNull: true },
      project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
        onDelete: 'CASCADE',
      },
      route_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'routes', key: 'id' },
      },
      // stage_id has no dedicated migration in this batch (no corresponding stages
      // table exists yet); kept as a plain UUID column, matching the model.
      stage_id: { type: Sequelize.UUID, allowNull: true },
      type: { type: Sequelize.STRING(20), allowNull: true },
      parent_notebook_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'notebooks', key: 'id' },
      },
      linked_notebook_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'notebooks', key: 'id' },
      },
      // template_id references a workflow/ard template table created in a different
      // migration batch; left unconstrained here to avoid ordering coupling.
      template_id: { type: Sequelize.UUID, allowNull: true },
      template_snapshot: { type: Sequelize.JSONB, allowNull: true },
      preliminary_complete: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      status: { type: Sequelize.STRING(20), allowNull: true, defaultValue: 'ACTIVE' },
      created_at: { type: Sequelize.DATE },
      updated_at: { type: Sequelize.DATE },
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notebooks')
  },
}
