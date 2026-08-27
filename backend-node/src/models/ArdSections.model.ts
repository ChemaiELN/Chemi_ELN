import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '../database/connection'

// ARD Templates rearchitecture (Extra/analysis/ard-templates-rearchitecture-prompt.md, §1).
// Sections and Data Items are reusable master data, attached to templates via join
// tables carrying per-attachment metadata, with a copy-on-save snapshot layer beneath
// them so an already-saved template version never changes when shared master data is
// edited later. Kept in its own file rather than growing ArdModels.model.ts further.

// ── ArdSection (master, reusable) ───────────────────────────────────────────────
export class ArdSection extends Model<InferAttributes<ArdSection>, InferCreationAttributes<ArdSection>> {
  declare id: CreationOptional<string>
  declare name: string
  declare description: string | null
  declare uniqueIdentifier: string | null
  declare sectionType: string
  declare deptId: string | null
  declare contentBlockId: string | null
  declare isActive: CreationOptional<boolean>
  declare createdById: string | null
  declare createdAt: CreationOptional<Date>
  declare lastUpdatedById: string | null
  declare updatedAt: CreationOptional<Date>
}
ArdSection.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  uniqueIdentifier: { type: DataTypes.STRING(100), allowNull: true, field: 'unique_identifier' },
  sectionType: { type: DataTypes.STRING(50), allowNull: false, field: 'section_type' },
  deptId: { type: DataTypes.UUID, allowNull: true, field: 'dept_id' },
  contentBlockId: { type: DataTypes.UUID, allowNull: true, field: 'content_block_id' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdById: { type: DataTypes.UUID, allowNull: true, field: 'created_by_id' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  lastUpdatedById: { type: DataTypes.UUID, allowNull: true, field: 'last_updated_by_id' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, { sequelize, tableName: 'ard_sections', timestamps: false })

// ── ArdSectionRichtext (1:1 extension: richtext / standard_preparation / ph) ────
export class ArdSectionRichtext extends Model<InferAttributes<ArdSectionRichtext>, InferCreationAttributes<ArdSectionRichtext>> {
  declare sectionId: string
  declare editorHeight: number | null
  declare editorWidth: number | null
  declare defaultContent: string | null
}
ArdSectionRichtext.init({
  sectionId: { type: DataTypes.UUID, primaryKey: true, field: 'section_id' },
  editorHeight: { type: DataTypes.INTEGER, allowNull: true, field: 'editor_height' },
  editorWidth: { type: DataTypes.INTEGER, allowNull: true, field: 'editor_width' },
  defaultContent: { type: DataTypes.TEXT, allowNull: true, field: 'default_content' },
}, { sequelize, tableName: 'ard_section_richtext', timestamps: false })

// ── ArdSectionDatatable (extension for `table`, and the table-half of `combined`) ──
export class ArdSectionDatatable extends Model<InferAttributes<ArdSectionDatatable>, InferCreationAttributes<ArdSectionDatatable>> {
  declare id: CreationOptional<string>
  declare sectionId: string
  declare name: string | null
  declare description: string | null
  declare typicalRowCount: CreationOptional<number>
}
ArdSectionDatatable.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  sectionId: { type: DataTypes.UUID, allowNull: false, field: 'section_id' },
  name: { type: DataTypes.STRING(200), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  typicalRowCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3, field: 'typical_row_count' },
}, { sequelize, tableName: 'ard_section_datatable', timestamps: false })

// ── ArdSectionEmbeddedFile (extension for `preconfigured_excel`) ────────────────
export class ArdSectionEmbeddedFile extends Model<InferAttributes<ArdSectionEmbeddedFile>, InferCreationAttributes<ArdSectionEmbeddedFile>> {
  declare sectionId: string
  declare fileName: string | null
  declare fileData: Buffer | null
  declare mappingFileName: string | null
  declare mappingFileData: Buffer | null
  declare workbookData: object | null
  declare metadata: object | null
}
ArdSectionEmbeddedFile.init({
  sectionId: { type: DataTypes.UUID, primaryKey: true, field: 'section_id' },
  fileName: { type: DataTypes.STRING(255), allowNull: true, field: 'file_name' },
  fileData: { type: DataTypes.BLOB('long'), allowNull: true, field: 'file_data' },
  mappingFileName: { type: DataTypes.STRING(255), allowNull: true, field: 'mapping_file_name' },
  mappingFileData: { type: DataTypes.BLOB('long'), allowNull: true, field: 'mapping_file_data' },
  workbookData: { type: DataTypes.JSONB, allowNull: true, field: 'workbook_data' },
  metadata: { type: DataTypes.JSONB, allowNull: true, field: 'metadata' },
}, { sequelize, tableName: 'ard_section_embedded_file', timestamps: false })

// ── ArdTemplateSection (join: template version ↔ section) ───────────────────────
export class ArdTemplateSection extends Model<InferAttributes<ArdTemplateSection>, InferCreationAttributes<ArdTemplateSection>> {
  declare id: CreationOptional<string>
  declare templateId: string
  declare sectionId: string
  declare sequenceNumber: CreationOptional<number>
  declare includeInCloning: CreationOptional<boolean>
  declare includeInEmpower: CreationOptional<boolean>
  declare updateSampleWeights: CreationOptional<boolean>
  declare updateResultSample: CreationOptional<boolean>
  declare includeReadWeighingExcel: CreationOptional<boolean>
  declare isMandatory: CreationOptional<boolean>
  declare isActive: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
ArdTemplateSection.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  templateId: { type: DataTypes.UUID, allowNull: false, field: 'template_id' },
  sectionId: { type: DataTypes.UUID, allowNull: false, field: 'section_id' },
  sequenceNumber: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sequence_number' },
  includeInCloning: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'include_in_cloning' },
  includeInEmpower: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'include_in_empower' },
  updateSampleWeights: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'update_sample_weights' },
  updateResultSample: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'update_result_sample' },
  includeReadWeighingExcel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'include_read_weighing_excel' },
  isMandatory: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_mandatory' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, { sequelize, tableName: 'ard_template_sections', timestamps: false })

// ── ArdSectionDataItem (join: section ↔ data item) ───────────────────────────────
export class ArdSectionDataItem extends Model<InferAttributes<ArdSectionDataItem>, InferCreationAttributes<ArdSectionDataItem>> {
  declare id: CreationOptional<string>
  declare sectionId: string
  declare dataItemId: string
  declare sequenceNumber: CreationOptional<number>
  declare isMandatory: CreationOptional<boolean>
  declare isActive: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
ArdSectionDataItem.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  sectionId: { type: DataTypes.UUID, allowNull: false, field: 'section_id' },
  dataItemId: { type: DataTypes.UUID, allowNull: false, field: 'data_item_id' },
  sequenceNumber: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sequence_number' },
  isMandatory: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_mandatory' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, { sequelize, tableName: 'ard_section_data_items', timestamps: false })

// ── ArdDatatableColumn (join: datatable ↔ data item as a column) ─────────────────
export class ArdDatatableColumn extends Model<InferAttributes<ArdDatatableColumn>, InferCreationAttributes<ArdDatatableColumn>> {
  declare id: CreationOptional<string>
  declare datatableId: string
  // Exactly one of dataItemId (governed Master Data column — table/combined
  // sections) or columnKey/columnLabel (old's fixed free-text GxP preset —
  // Lab Component sections) is set, never both. See migration 20260825000003.
  declare dataItemId: string | null
  declare columnKey: string | null
  declare columnLabel: string | null
  declare sequenceNumber: CreationOptional<number>
  declare relativeWidth: number
  declare isMandatory: CreationOptional<boolean>
  declare isActive: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
ArdDatatableColumn.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  datatableId: { type: DataTypes.UUID, allowNull: false, field: 'datatable_id' },
  dataItemId: { type: DataTypes.UUID, allowNull: true, field: 'data_item_id' },
  columnKey: { type: DataTypes.STRING(100), allowNull: true, field: 'column_key' },
  columnLabel: { type: DataTypes.STRING(200), allowNull: true, field: 'column_label' },
  sequenceNumber: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sequence_number' },
  relativeWidth: { type: DataTypes.DECIMAL(5, 2), allowNull: false, field: 'relative_width' },
  isMandatory: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_mandatory' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, { sequelize, tableName: 'ard_datatable_columns', timestamps: false })

// ── Snapshot tables (copy-on-save; see §1.10 / §4 of the rearchitecture prompt) ──

export class ArdTemplateSectionRichtextSnapshot extends Model<InferAttributes<ArdTemplateSectionRichtextSnapshot>, InferCreationAttributes<ArdTemplateSectionRichtextSnapshot>> {
  declare id: CreationOptional<string>
  declare templateId: string
  declare sectionId: string
  declare editorHeight: number | null
  declare editorWidth: number | null
  declare defaultContent: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
ArdTemplateSectionRichtextSnapshot.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  templateId: { type: DataTypes.UUID, allowNull: false, field: 'template_id' },
  sectionId: { type: DataTypes.UUID, allowNull: false, field: 'section_id' },
  editorHeight: { type: DataTypes.INTEGER, allowNull: true, field: 'editor_height' },
  editorWidth: { type: DataTypes.INTEGER, allowNull: true, field: 'editor_width' },
  defaultContent: { type: DataTypes.TEXT, allowNull: true, field: 'default_content' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, { sequelize, tableName: 'ard_template_section_richtext_snapshot', timestamps: false })

export class ArdTemplateSectionDataItemSnapshot extends Model<InferAttributes<ArdTemplateSectionDataItemSnapshot>, InferCreationAttributes<ArdTemplateSectionDataItemSnapshot>> {
  declare id: CreationOptional<string>
  declare templateId: string
  declare sectionId: string
  declare dataItemId: string
  declare name: string
  declare dataType: string
  declare lengthCategory: string | null
  declare sequenceNumber: CreationOptional<number>
  declare isMandatory: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
ArdTemplateSectionDataItemSnapshot.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  templateId: { type: DataTypes.UUID, allowNull: false, field: 'template_id' },
  sectionId: { type: DataTypes.UUID, allowNull: false, field: 'section_id' },
  dataItemId: { type: DataTypes.UUID, allowNull: false, field: 'data_item_id' },
  name: { type: DataTypes.STRING(200), allowNull: false },
  dataType: { type: DataTypes.STRING(20), allowNull: false, field: 'data_type' },
  lengthCategory: { type: DataTypes.STRING(10), allowNull: true, field: 'length_category' },
  sequenceNumber: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sequence_number' },
  isMandatory: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_mandatory' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, { sequelize, tableName: 'ard_template_section_data_items_snapshot', timestamps: false })

export class ArdTemplateSectionDatatableSnapshot extends Model<InferAttributes<ArdTemplateSectionDatatableSnapshot>, InferCreationAttributes<ArdTemplateSectionDatatableSnapshot>> {
  declare id: CreationOptional<string>
  declare templateId: string
  declare sectionId: string
  declare datatableId: string
  declare name: string | null
  declare description: string | null
  declare typicalRowCount: CreationOptional<number>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
ArdTemplateSectionDatatableSnapshot.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  templateId: { type: DataTypes.UUID, allowNull: false, field: 'template_id' },
  sectionId: { type: DataTypes.UUID, allowNull: false, field: 'section_id' },
  datatableId: { type: DataTypes.UUID, allowNull: false, field: 'datatable_id' },
  name: { type: DataTypes.STRING(200), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  typicalRowCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3, field: 'typical_row_count' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, { sequelize, tableName: 'ard_template_section_datatable_snapshot', timestamps: false })

export class ArdTemplateDatatableColumnSnapshot extends Model<InferAttributes<ArdTemplateDatatableColumnSnapshot>, InferCreationAttributes<ArdTemplateDatatableColumnSnapshot>> {
  declare id: CreationOptional<string>
  declare templateId: string
  declare datatableSnapshotId: string
  declare dataItemId: string | null
  declare columnKey: string | null
  declare columnLabel: string | null
  declare sequenceNumber: CreationOptional<number>
  declare relativeWidth: number
  declare isMandatory: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
ArdTemplateDatatableColumnSnapshot.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  templateId: { type: DataTypes.UUID, allowNull: false, field: 'template_id' },
  datatableSnapshotId: { type: DataTypes.UUID, allowNull: false, field: 'datatable_snapshot_id' },
  dataItemId: { type: DataTypes.UUID, allowNull: true, field: 'data_item_id' },
  columnKey: { type: DataTypes.STRING(100), allowNull: true, field: 'column_key' },
  columnLabel: { type: DataTypes.STRING(200), allowNull: true, field: 'column_label' },
  sequenceNumber: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sequence_number' },
  relativeWidth: { type: DataTypes.DECIMAL(5, 2), allowNull: false, field: 'relative_width' },
  isMandatory: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_mandatory' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, { sequelize, tableName: 'ard_template_datatable_column_snapshot', timestamps: false })

export class ArdTemplateSectionEmbeddedFileSnapshot extends Model<InferAttributes<ArdTemplateSectionEmbeddedFileSnapshot>, InferCreationAttributes<ArdTemplateSectionEmbeddedFileSnapshot>> {
  declare id: CreationOptional<string>
  declare templateId: string
  declare sectionId: string
  declare fileName: string | null
  declare fileData: Buffer | null
  declare mappingFileName: string | null
  declare mappingFileData: Buffer | null
  declare workbookData: object | null
  declare metadata: object | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
ArdTemplateSectionEmbeddedFileSnapshot.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  templateId: { type: DataTypes.UUID, allowNull: false, field: 'template_id' },
  sectionId: { type: DataTypes.UUID, allowNull: false, field: 'section_id' },
  fileName: { type: DataTypes.STRING(255), allowNull: true, field: 'file_name' },
  fileData: { type: DataTypes.BLOB('long'), allowNull: true, field: 'file_data' },
  mappingFileName: { type: DataTypes.STRING(255), allowNull: true, field: 'mapping_file_name' },
  mappingFileData: { type: DataTypes.BLOB('long'), allowNull: true, field: 'mapping_file_data' },
  workbookData: { type: DataTypes.JSONB, allowNull: true, field: 'workbook_data' },
  metadata: { type: DataTypes.JSONB, allowNull: true, field: 'metadata' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, { sequelize, tableName: 'ard_template_section_embedded_file_snapshot', timestamps: false })
