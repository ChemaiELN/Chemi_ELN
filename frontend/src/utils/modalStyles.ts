import type { ModalProps } from 'antd'

export const glassModalStyles = {
  mask: {
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    background: 'rgba(15, 23, 42, 0.18)',
  },
  content: {
    background: '#FEFEFA',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    border: '1px solid rgba(255, 255, 255, 0.65)',
    boxShadow: '0 24px 60px rgba(124, 58, 237, 0.18), 0 4px 20px rgba(0,0,0,0.06)',
    borderRadius: 10,
    padding: 0,
    overflow: 'hidden',
  },
  header: {
    background: 'transparent',
    padding: '16px 24px 0px',
    margin: 0,
    cursor: 'move',
  },
  body: {
    background: 'transparent',
    padding: '14px 22px 8px',
  },
  footer: {
    padding: '12px 22px 16px',
    margin: 0,
  },
}

export const glassModalProps: Pick<ModalProps, 'styles' | 'width' | 'maskClosable'> = {
  styles: glassModalStyles,
  width: 780,
  maskClosable: false,
}

export function useModalStyles(): ModalProps['styles'] {
  return glassModalStyles
}
