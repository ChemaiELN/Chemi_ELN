'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('cgt_processes', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      name: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    })

    await queryInterface.createTable('template_dropdown_selections', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      scope: { type: Sequelize.STRING(10), allowNull: false }, // 'ADC' | 'CGT'
      process_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'cgt_processes', key: 'id' },
        onDelete: 'CASCADE',
      },
      template_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'workflow_templates', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
    })

    await queryInterface.addIndex('template_dropdown_selections', ['scope', 'process_id', 'template_id'], {
      unique: true,
      name: 'template_dropdown_selections_unique',
    })

    // Seed the three existing CGT processes so nothing regresses for
    // in-flight projects/notebooks that already reference these names.
    const now = new Date()
    await queryInterface.bulkInsert('cgt_processes', [
      { id: Sequelize.literal('gen_random_uuid()'), name: 'Molecular Biology', sort_order: 1, is_active: true, created_at: now, updated_at: now },
      { id: Sequelize.literal('gen_random_uuid()'), name: 'Plasmid', sort_order: 2, is_active: true, created_at: now, updated_at: now },
      { id: Sequelize.literal('gen_random_uuid()'), name: 'AAV', sort_order: 3, is_active: true, created_at: now, updated_at: now },
    ])
  },

  async down(queryInterface) {
    await queryInterface.dropTable('template_dropdown_selections')
    await queryInterface.dropTable('cgt_processes')
  },
}
