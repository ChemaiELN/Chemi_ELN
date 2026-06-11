import React from 'react'
import { Typography } from 'antd'

interface EllipsisCellProps {
  text?: string | null
  className?: string
  style?: React.CSSProperties
  empty?: React.ReactNode
}

export default function EllipsisCell({ text, className, style, empty = '—' }: EllipsisCellProps) {
  if (!text) {
    return <span className={className}>{empty}</span>
  }
  return (
    <Typography.Text
      ellipsis={{ tooltip: text }}
      className={className}
      style={{ maxWidth: '100%', display: 'block', ...style }}
    >
      {text}
    </Typography.Text>
  )
}
