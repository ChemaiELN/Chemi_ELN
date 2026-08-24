import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute } from 'sequelize'
import { sequelize } from '../database/connection'

export class Notebook extends Model<InferAttributes<Notebook>, InferCreationAttributes<Notebook>> {
  declare id: CreationOptional<string>
  declare code: string
  declare title: string
  declare description: string | null
  declare projectId: string
  declare routeId: string | null
  declare stageId: string | null
  declare type: string | null
  declare parentNotebookId: string | null
  declare linkedNotebookId: string | null
  declare templateId: string | null
  declare templateSnapshot: object | null
  declare preliminaryComplete: CreationOptional<boolean>
  declare createdBy: string | null
  declare status: CreationOptional<string>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  declare project?: NonAttribute<unknown>
  declare permissions?: NonAttribute<unknown[]>
}

Notebook.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  title: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.STRING(1000), allowNull: true },
  projectId: { type: DataTypes.UUID, allowNull: false, field: 'project_id' },
  routeId: { type: DataTypes.UUID, allowNull: true, field: 'route_id' },
  stageId: { type: DataTypes.UUID, allowNull: true, field: 'stage_id' },
  type: { type: DataTypes.STRING(20), allowNull: true },
  parentNotebookId: { type: DataTypes.UUID, allowNull: true, field: 'parent_notebook_id' },
  linkedNotebookId: { type: DataTypes.UUID, allowNull: true, field: 'linked_notebook_id' },
  templateId: { type: DataTypes.UUID, allowNull: true, field: 'template_id' },
  templateSnapshot: { type: DataTypes.JSONB, allowNull: true, field: 'template_snapshot' },
  preliminaryComplete: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'preliminary_complete' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  status: { type: DataTypes.STRING(20), defaultValue: 'ACTIVE' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'notebooks',
  timestamps: false,
})

export class NotebookPermission extends Model<InferAttributes<NotebookPermission>, InferCreationAttributes<NotebookPermission>> {
  declare id: CreationOptional<string>
  declare notebookId: string
  declare userId: string
  declare canView: CreationOptional<boolean>
  declare canEdit: CreationOptional<boolean>
  declare canSubmit: CreationOptional<boolean>
  declare canVerify: CreationOptional<boolean>
  declare canApprove: CreationOptional<boolean>
  declare canClone: CreationOptional<boolean>
  declare canExport: CreationOptional<boolean>
  declare canAttach: CreationOptional<boolean>
  declare canComment: CreationOptional<boolean>
  declare canRequestUnlock: CreationOptional<boolean>
  declare canDeactivate: CreationOptional<boolean>
  declare grantedBy: string | null
  declare grantedAt: CreationOptional<Date>
}

NotebookPermission.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  notebookId: { type: DataTypes.UUID, allowNull: false, field: 'notebook_id' },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  canView: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'can_view' },
  canEdit: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'can_edit' },
  canSubmit: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'can_submit' },
  canVerify: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'can_verify' },
  canApprove: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'can_approve' },
  canClone: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'can_clone' },
  canExport: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'can_export' },
  canAttach: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'can_attach' },
  canComment: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'can_comment' },
  canRequestUnlock: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'can_request_unlock' },
  canDeactivate: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'can_deactivate' },
  grantedBy: { type: DataTypes.UUID, allowNull: true, field: 'granted_by' },
  // granted_at is NOT NULL in the DB with no server-side default, and assign-user
  // never set it — every grant insert failed with a not-null violation.
  grantedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'granted_at' },
}, {
  sequelize,
  tableName: 'notebook_permissions',
  timestamps: false,
})

