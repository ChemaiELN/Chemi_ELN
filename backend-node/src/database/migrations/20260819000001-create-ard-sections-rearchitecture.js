'use strict'

const { randomUUID } = require('crypto')

// ARD Templates rearchitecture (see Extra/analysis/ard-templates-rearchitecture-prompt.md, §1/§2).
// Sections and Data Items become reusable master data, attached to templates via join
// tables, with an immutable copy-on-save snapshot layer so editing shared master data
// never retroactively changes an already-saved template version.
//
// This migration does NOT drop ard_templates.sections (JSONB) — that stays until the
// backfill script (§6 of the prompt) has migrated existing rows and been verified.
//
// It DOES alter the existing, already-live ard_data_items table in place (confirmed
// with product owner 2026-08-19): dataType moves from a free string to the fixed
// TEXT|LOV|DATE|NUMBER enum, lengthCategory/lovLookupCategory are added, and the old
// inline `options` column is retired — its values are backfilled into master_data_items
// (category `ARD:DataItem:<id>`) so existing dropdown/radio/checkbox data items keep
// their selectable values via the shared LOV mechanism (§1.9) instead of inline JSON.
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date()

    // ── 1. ard_data_items: migrate in place ──────────────────────────────────
    await queryInterface.addColumn('ard_data_items', 'length_category', {
      type: Sequelize.STRING(10),
      allowNull: true,
    })
    await queryInterface.addColumn('ard_data_items', 'lov_lookup_category', {
      type: Sequelize.STRING(100),
      allowNull: true,
    })

    const [existingItems] = await queryInterface.sequelize.query(
      'SELECT id, data_type, options FROM ard_data_items',
    )

    const LEGACY_TO_ENUM = {
      text: 'TEXT',
      number: 'NUMBER',
      date: 'DATE',
      select: 'LOV',
      radio: 'LOV',
      checkbox: 'LOV',
    }

    for (const row of existingItems) {
      const legacyType = String(row.data_type || '').toLowerCase()
      const newType = LEGACY_TO_ENUM[legacyType] || 'TEXT'
      let lengthCategory = 'SHORT'
      let lovLookupCategory = null

      if (newType === 'TEXT') {
        lengthCategory = 'MEDIUM'
      }

      if (newType === 'LOV') {
        const options = Array.isArray(row.options) ? row.options : (row.options ? JSON.parse(row.options) : [])
        if (options.length) {
          lovLookupCategory = `ARD:DataItem:${row.id}`
          for (let i = 0; i < options.length; i++) {
            const opt = options[i]
            await queryInterface.sequelize.query(
              `INSERT INTO master_data_items (id, category, code, name, description, sort_order, is_active, created_at, updated_at)
               VALUES (:id, :category, :code, :name, NULL, :sortOrder, true, :now, :now)`,
              {
                replacements: {
                  id: randomUUID(),
                  category: lovLookupCategory,
                  code: String(opt.value ?? opt.label ?? ''),
                  name: String(opt.label ?? opt.value ?? ''),
                  sortOrder: i,
                  now,
                },
              },
            )
          }
        }
      }

      await queryInterface.sequelize.query(
        `UPDATE ard_data_items SET data_type = :newType, length_category = :lengthCategory, lov_lookup_category = :lovLookupCategory WHERE id = :id`,
        { replacements: { newType, lengthCategory, lovLookupCategory, id: row.id } },
      )
    }

    await queryInterface.removeColumn('ard_data_items', 'options')

    // ── 2. ard_sections (new — master, reusable) ─────────────────────────────
    await queryInterface.createTable('ard_sections', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      unique_identifier: { type: Sequelize.STRING(100), allowNull: true },
      section_type: { type: Sequelize.STRING(50), allowNull: false },
      dept_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'departments', key: 'id' }, onDelete: 'SET NULL' },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      last_updated_by_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    })
    await queryInterface.addConstraint('ard_sections', {
      fields: ['name', 'unique_identifier'],
      type: 'unique',
      name: 'ard_sections_name_unique_identifier_unique',
    })

    // ── 3. Type-specific 1:1 extensions ──────────────────────────────────────
    await queryInterface.createTable('ard_section_richtext', {
      section_id: { type: Sequelize.UUID, primaryKey: true, references: { model: 'ard_sections', key: 'id' }, onDelete: 'CASCADE' },
      editor_height: { type: Sequelize.INTEGER, allowNull: true },
      editor_width: { type: Sequelize.INTEGER, allowNull: true },
      default_content: { type: Sequelize.TEXT, allowNull: true },
    })

    await queryInterface.createTable('ard_section_datatable', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      section_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_sections', key: 'id' }, onDelete: 'CASCADE' },
      name: { type: Sequelize.STRING(200), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      typical_row_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
    })
    await queryInterface.addIndex('ard_section_datatable', ['section_id'], { name: 'ard_section_datatable_section_idx' })

    await queryInterface.createTable('ard_section_embedded_file', {
      section_id: { type: Sequelize.UUID, primaryKey: true, references: { model: 'ard_sections', key: 'id' }, onDelete: 'CASCADE' },
      file_name: { type: Sequelize.STRING(255), allowNull: true },
      file_data: { type: Sequelize.BLOB('long'), allowNull: true },
      mapping_file_name: { type: Sequelize.STRING(255), allowNull: true },
      mapping_file_data: { type: Sequelize.BLOB('long'), allowNull: true },
    })

    // ── 4. Join tables ────────────────────────────────────────────────────────
    await queryInterface.createTable('ard_template_sections', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      template_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_templates', key: 'id' }, onDelete: 'CASCADE' },
      section_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_sections', key: 'id' }, onDelete: 'RESTRICT' },
      sequence_number: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      include_in_cloning: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      include_in_empower: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      update_sample_weights: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      update_result_sample: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      include_read_weighing_excel: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    })
    await queryInterface.addIndex('ard_template_sections', ['template_id'], { name: 'ard_template_sections_template_idx' })
    await queryInterface.addIndex('ard_template_sections', ['section_id'], { name: 'ard_template_sections_section_idx' })

    await queryInterface.createTable('ard_section_data_items', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      section_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_sections', key: 'id' }, onDelete: 'CASCADE' },
      data_item_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_data_items', key: 'id' }, onDelete: 'RESTRICT' },
      sequence_number: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_mandatory: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    })
    await queryInterface.addIndex('ard_section_data_items', ['section_id'], { name: 'ard_section_data_items_section_idx' })
    await queryInterface.addIndex('ard_section_data_items', ['data_item_id'], { name: 'ard_section_data_items_data_item_idx' })

    await queryInterface.createTable('ard_datatable_columns', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      datatable_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_section_datatable', key: 'id' }, onDelete: 'CASCADE' },
      data_item_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_data_items', key: 'id' }, onDelete: 'RESTRICT' },
      sequence_number: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      relative_width: { type: Sequelize.DECIMAL(5, 2), allowNull: false },
      is_mandatory: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    })
    await queryInterface.addIndex('ard_datatable_columns', ['datatable_id'], { name: 'ard_datatable_columns_datatable_idx' })
    await queryInterface.addIndex('ard_datatable_columns', ['data_item_id'], { name: 'ard_datatable_columns_data_item_idx' })

    // ── 5. Snapshot tables (copy-on-save; keyed by template_id + section_id[, ...]) ──
    await queryInterface.createTable('ard_template_section_richtext_snapshot', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      template_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_templates', key: 'id' }, onDelete: 'CASCADE' },
      section_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_sections', key: 'id' }, onDelete: 'RESTRICT' },
      editor_height: { type: Sequelize.INTEGER, allowNull: true },
      editor_width: { type: Sequelize.INTEGER, allowNull: true },
      default_content: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    })
    await queryInterface.addConstraint('ard_template_section_richtext_snapshot', {
      fields: ['template_id', 'section_id'], type: 'unique', name: 'ard_tpl_section_richtext_snap_unique',
    })

    await queryInterface.createTable('ard_template_section_data_items_snapshot', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      template_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_templates', key: 'id' }, onDelete: 'CASCADE' },
      section_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_sections', key: 'id' }, onDelete: 'RESTRICT' },
      data_item_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_data_items', key: 'id' }, onDelete: 'RESTRICT' },
      name: { type: Sequelize.STRING(200), allowNull: false },
      data_type: { type: Sequelize.STRING(20), allowNull: false },
      length_category: { type: Sequelize.STRING(10), allowNull: true },
      sequence_number: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_mandatory: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    })
    await queryInterface.addConstraint('ard_template_section_data_items_snapshot', {
      fields: ['template_id', 'section_id', 'data_item_id'], type: 'unique', name: 'ard_tpl_section_data_items_snap_unique',
    })

    await queryInterface.createTable('ard_template_section_datatable_snapshot', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      template_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_templates', key: 'id' }, onDelete: 'CASCADE' },
      section_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_sections', key: 'id' }, onDelete: 'RESTRICT' },
      datatable_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_section_datatable', key: 'id' }, onDelete: 'RESTRICT' },
      name: { type: Sequelize.STRING(200), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      typical_row_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    })
    await queryInterface.addConstraint('ard_template_section_datatable_snapshot', {
      fields: ['template_id', 'section_id', 'datatable_id'], type: 'unique', name: 'ard_tpl_section_datatable_snap_unique',
    })

    await queryInterface.createTable('ard_template_datatable_column_snapshot', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      template_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_templates', key: 'id' }, onDelete: 'CASCADE' },
      datatable_snapshot_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_template_section_datatable_snapshot', key: 'id' }, onDelete: 'CASCADE' },
      data_item_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_data_items', key: 'id' }, onDelete: 'RESTRICT' },
      sequence_number: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      relative_width: { type: Sequelize.DECIMAL(5, 2), allowNull: false },
      is_mandatory: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    })
    await queryInterface.addConstraint('ard_template_datatable_column_snapshot', {
      fields: ['datatable_snapshot_id', 'data_item_id'], type: 'unique', name: 'ard_tpl_datatable_column_snap_unique',
    })

    await queryInterface.createTable('ard_template_section_embedded_file_snapshot', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      template_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_templates', key: 'id' }, onDelete: 'CASCADE' },
      section_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'ard_sections', key: 'id' }, onDelete: 'RESTRICT' },
      file_name: { type: Sequelize.STRING(255), allowNull: true },
      file_data: { type: Sequelize.BLOB('long'), allowNull: true },
      mapping_file_name: { type: Sequelize.STRING(255), allowNull: true },
      mapping_file_data: { type: Sequelize.BLOB('long'), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    })
    await queryInterface.addConstraint('ard_template_section_embedded_file_snapshot', {
      fields: ['template_id', 'section_id'], type: 'unique', name: 'ard_tpl_section_embedded_file_snap_unique',
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ard_template_section_embedded_file_snapshot')
    await queryInterface.dropTable('ard_template_datatable_column_snapshot')
    await queryInterface.dropTable('ard_template_section_datatable_snapshot')
    await queryInterface.dropTable('ard_template_section_data_items_snapshot')
    await queryInterface.dropTable('ard_template_section_richtext_snapshot')
    await queryInterface.dropTable('ard_datatable_columns')
    await queryInterface.dropTable('ard_section_data_items')
    await queryInterface.dropTable('ard_template_sections')
    await queryInterface.dropTable('ard_section_embedded_file')
    await queryInterface.dropTable('ard_section_datatable')
    await queryInterface.dropTable('ard_section_richtext')
    await queryInterface.dropTable('ard_sections')

    await queryInterface.addColumn('ard_data_items', 'options', { type: 'JSON', allowNull: true })
    await queryInterface.removeColumn('ard_data_items', 'lov_lookup_category')
    await queryInterface.removeColumn('ard_data_items', 'length_category')
    // Note: legacy free-string dataType values and inline option rows migrated into
    // master_data_items are not restored on down() — this is a one-way data migration.
  },
}
