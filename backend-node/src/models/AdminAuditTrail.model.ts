import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '../database/connection'

// Audit trail for the Administration module — mirrors InvAuditTrail's shape
// (see InventoryModels.model.ts) so the two can share the same kind of
// read/filter UI, even though they're independent tables.
export class AdminAuditTrail extends Model<InferAttributes<AdminAuditTrail>, InferCreationAttributes<AdminAuditTrail>> {
  declare id: CreationOptional<number>
  declare eventType: string
  declare entityType: string
  declare entityId: string | null
  declare entityRef: string | null
  declare performedBy: string
  declare performedAt: CreationOptional<Date>
  declare oldValue: string | null
  declare newValue: string | null
  declare details: string | null
}

AdminAuditTrail.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  eventType: { type: DataTypes.STRING(50), allowNull: false, field: 'event_type' },
  entityType: { type: DataTypes.STRING(50), allowNull: false, field: 'entity_type' },
  entityId: { type: DataTypes.STRING(100), allowNull: true, field: 'entity_id' },
  entityRef: { type: DataTypes.STRING(200), allowNull: true, field: 'entity_ref' },
  performedBy: { type: DataTypes.STRING(200), allowNull: false, field: 'performed_by' },
  performedAt: { type: DataTypes.DATE, allowNull: false, field: 'performed_at', defaultValue: DataTypes.NOW },
  oldValue: { type: DataTypes.TEXT, allowNull: true, field: 'old_value' },
  newValue: { type: DataTypes.TEXT, allowNull: true, field: 'new_value' },
  details: { type: DataTypes.TEXT, allowNull: true },
}, { sequelize, tableName: 'admin_audit_trail', timestamps: false })
