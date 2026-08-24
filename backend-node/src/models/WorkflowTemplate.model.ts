import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '../database/connection'

export class WorkflowTemplate extends Model<InferAttributes<WorkflowTemplate>, InferCreationAttributes<WorkflowTemplate>> {
  declare id: CreationOptional<string>
  declare name: string
  declare slug: string
  declare description: string | null
  declare category: string | null
  declare version: CreationOptional<number>
  declare isActive: CreationOptional<boolean>
  declare showInNotebookDropdown: CreationOptional<boolean>
  declare definition: object | null
  declare createdBy: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

WorkflowTemplate.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING(255), allowNull: false },
  slug: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  category: { type: DataTypes.STRING(100), allowNull: true },
  version: { type: DataTypes.INTEGER, defaultValue: 1 },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  // Independent of isActive/Publish state: lets a published template be kept
  // usable (e.g. still referenced by existing notebooks) while being hidden
  // from the "Create Notebook" template picker — see AdcProjectDetailPage.tsx.
  showInNotebookDropdown: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'show_in_notebook_dropdown' },
  definition: { type: DataTypes.JSONB, allowNull: true },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'workflow_templates',
  timestamps: false,
})

export class WorkflowTemplateVersion extends Model<InferAttributes<WorkflowTemplateVersion>, InferCreationAttributes<WorkflowTemplateVersion>> {
  declare id: CreationOptional<string>
  declare templateId: string
  declare version: number
  declare definition: object | null
  declare savedBy: string | null
  declare savedAt: CreationOptional<Date>
}

WorkflowTemplateVersion.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  templateId: { type: DataTypes.UUID, allowNull: false, field: 'template_id' },
  version: { type: DataTypes.INTEGER, allowNull: false },
  definition: { type: DataTypes.JSONB, allowNull: true },
  savedBy: { type: DataTypes.UUID, allowNull: true, field: 'saved_by' },
  savedAt: { type: DataTypes.DATE, field: 'saved_at' },
}, {
  sequelize,
  tableName: 'workflow_template_versions',
  timestamps: false,
})

export class CalcSheetTemplate extends Model<InferAttributes<CalcSheetTemplate>, InferCreationAttributes<CalcSheetTemplate>> {
  declare id: CreationOptional<string>
  declare name: string
  declare slug: string
  declare category: string | null
  declare version: CreationOptional<number>
  declare isActive: CreationOptional<boolean>
  declare workbookData: object | null
  declare fieldMetadata: object | null
  declare createdBy: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

CalcSheetTemplate.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING(255), allowNull: false },
  slug: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  category: { type: DataTypes.STRING(100), allowNull: true },
  version: { type: DataTypes.INTEGER, defaultValue: 1 },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  workbookData: { type: DataTypes.JSONB, allowNull: true, field: 'workbook_data' },
  fieldMetadata: { type: DataTypes.JSONB, allowNull: true, field: 'field_metadata' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'calc_sheet_templates',
  timestamps: false,
})

export class CalcSheetTemplateVersion extends Model<InferAttributes<CalcSheetTemplateVersion>, InferCreationAttributes<CalcSheetTemplateVersion>> {
  declare id: CreationOptional<string>
  declare templateId: string
  declare version: number
  declare workbookData: object | null
  declare fieldMetadata: object | null
  declare savedBy: string | null
  declare savedAt: CreationOptional<Date>
}

CalcSheetTemplateVersion.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  templateId: { type: DataTypes.UUID, allowNull: false, field: 'template_id' },
  version: { type: DataTypes.INTEGER, allowNull: false },
  workbookData: { type: DataTypes.JSONB, allowNull: true, field: 'workbook_data' },
  fieldMetadata: { type: DataTypes.JSONB, allowNull: true, field: 'field_metadata' },
  savedBy: { type: DataTypes.UUID, allowNull: true, field: 'saved_by' },
  savedAt: { type: DataTypes.DATE, field: 'saved_at' },
}, {
  sequelize,
  tableName: 'calc_sheet_template_versions',
  timestamps: false,
})
