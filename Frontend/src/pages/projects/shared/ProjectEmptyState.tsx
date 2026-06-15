import { InboxOutlined } from '@ant-design/icons'
import styles from './styles.module.less'

interface ProjectEmptyStateProps {
  message: string
  compact?: boolean
}

export default function ProjectEmptyState({ message, compact }: ProjectEmptyStateProps) {
  return (
    <div className={`${styles.emptyState} ${compact ? styles.emptyStateCompact : ''}`}>
      <InboxOutlined className={styles.emptyStateIcon} aria-hidden />
      <p className={styles.emptyStateText}>{message}</p>
    </div>
  )
}
