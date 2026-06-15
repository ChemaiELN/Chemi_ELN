import React from 'react'
import { Button } from 'antd'
import type { ButtonProps } from 'antd'
import { Plus } from 'lucide-react'
import styles from '../../views/styles.module.less'

export function InventoryCountBadge({ count, label }: { count: number; label?: string }) {
  return (
    <span className={styles.countBadge}>
      {count}{label ? ` ${label}` : ''}
    </span>
  )
}

export function InventoryAddButton({ children, className, ...rest }: ButtonProps) {
  return (
    <Button
      size="small"
      icon={<Plus size={16} strokeWidth={2.5} aria-hidden />}
      className={[styles.newBtn, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </Button>
  )
}
