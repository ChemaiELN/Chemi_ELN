import { Tag } from 'antd'
import styles from './styles.module.less'
import {
  formatStatusLabel,
  resolveStatusVariant,
  statusVariantClass,
  type StatusVariant,
} from './variants'

export type { StatusVariant }
export { formatStatusLabel, normalizeStatus, resolveStatusVariant } from './variants'

interface StatusTagProps {
  status: string
  /** Override displayed text */
  label?: string
  /** Force a specific visual variant instead of auto-resolving from status */
  variant?: StatusVariant
  className?: string
}

export default function StatusTag({ status, label, variant, className }: StatusTagProps) {
  const resolved = variant ?? resolveStatusVariant(status)
  const classes = [styles.tag, statusVariantClass(resolved), className].filter(Boolean).join(' ')

  return (
    <Tag className={classes} bordered={false}>
      {formatStatusLabel(status, label)}
    </Tag>
  )
}
