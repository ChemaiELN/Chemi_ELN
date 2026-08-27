import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '../database/connection'

// The list of CGT "Process" options (Molecular Biology, Plasmid, AAV, …),
// admin-managed instead of the old hardcoded PROCESS_OPTIONS array on
// CgtProjectsPage.tsx. CgtProject.process still stores the plain name string
// (unchanged shape), this table is only the admin-curated source of options.
export class CgtProcess extends Model<InferAttributes<CgtProcess>, InferCreationAttributes<CgtProcess>> {
  declare id: CreationOptional<string>
  declare name: string
  declare sortOrder: CreationOptional<number>
  declare isActive: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

CgtProcess.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0, field: 'sort_order' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'cgt_processes',
  timestamps: false,
})

// Admin-curated set of workflow templates offered in a given "Create
// Notebook" dropdown. scope='ADC' rows have processId=null (one flat ADC
// list); scope='CGT' rows are scoped per CgtProcess.
export class TemplateDropdownSelection extends Model<InferAttributes<TemplateDropdownSelection>, InferCreationAttributes<TemplateDropdownSelection>> {
  declare id: CreationOptional<string>
  declare scope: 'ADC' | 'CGT'
  declare processId: string | null
  declare templateId: string
  declare createdAt: CreationOptional<Date>
}

TemplateDropdownSelection.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  scope: { type: DataTypes.STRING(10), allowNull: false },
  processId: { type: DataTypes.UUID, allowNull: true, field: 'process_id' },
  templateId: { type: DataTypes.UUID, allowNull: false, field: 'template_id' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
}, {
  sequelize,
  tableName: 'template_dropdown_selections',
  timestamps: false,
})
