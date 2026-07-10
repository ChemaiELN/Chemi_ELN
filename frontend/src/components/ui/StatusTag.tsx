import { Tag } from 'antd'
import type { TagProps } from 'antd'
import type { ReactNode } from 'react'

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function processChildren(children: ReactNode): ReactNode {
  if (typeof children === 'string') return toTitleCase(children)
  return children
}

export function StatusTag({ style, children, ...props }: TagProps) {
  return (
    <Tag
      bordered
      {...props}
      style={{ fontSize: 11, borderColor: 'currentColor', ...style }}
    >
      {processChildren(children)}
    </Tag>
  )
}
