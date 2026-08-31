import { useRef, useState, type ReactNode } from 'react'
import Draggable from 'react-draggable'
import { Modal, type ModalProps } from 'antd'
import { glassModalProps } from '../../utils/modalStyles'

export function useDraggableModal() {
  const dragRef = useRef<HTMLDivElement>(null)
  const [disabled, setDisabled] = useState(true)
  const [bounds, setBounds] = useState({ left: 0, top: 0, bottom: 0, right: 0 })

  const onStart = (_: unknown, uiData: { x: number; y: number }) => {
    const target = dragRef.current
    if (!target) return
    const rect = target.getBoundingClientRect()
    setBounds({
      left: -rect.left + uiData.x,
      right: document.body.clientWidth - (rect.right - uiData.x),
      top: -rect.top + uiData.y,
      bottom: document.body.clientHeight - (rect.bottom - uiData.y),
    })
  }

  const modalRender = (modal: ReactNode) => (
    <Draggable
      nodeRef={dragRef}
      disabled={disabled}
      bounds={bounds}
      onStart={onStart}
      handle=".admin-modal-drag-handle"
    >
      <div ref={dragRef}>{modal}</div>
    </Draggable>
  )

  const titleProps = {
    className: 'admin-modal-drag-handle',
    onMouseEnter: () => setDisabled(false),
    onMouseLeave: () => setDisabled(true),
    style: { cursor: 'move', userSelect: 'none' as const },
  }

  const wrapTitle = (title: ReactNode) => {
    if (title == null) return title
    return <div {...titleProps}>{title}</div>
  }

  return { modalRender, titleProps, wrapTitle }
}

/** Admin modal with glass styling and header drag. */
export function AdminModal({ title, styles, ...props }: ModalProps) {
  const { modalRender, wrapTitle } = useDraggableModal()
  return (
    <Modal
      {...glassModalProps}
      styles={{ ...glassModalProps.styles, ...styles }}
      modalRender={modalRender}
      title={wrapTitle(title)}
      {...props}
    />
  )
}
