import type { ModalProps } from 'antd'

export const glassModalStyles = {
  mask: {
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    background: 'rgba(109, 40, 217, 0.10)',
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
    // borderBottom: '1px solid rgba(196,181,253,0.35)',
    padding: '16px 24px 0px',
    margin: 0,
  },
  body: {
    background: 'transparent',
    padding: '14px 22px 8px',
  },
  footer: {
    // background: 'rgba(245,243,255,0.6)',
    // borderTop: '1px solid rgba(196,181,253,0.3)',
    padding: '12px 22px 16px',
    margin: 0,
  },
}

export const glassModalProps: Pick<ModalProps, 'styles'> = {
  styles: glassModalStyles,
}

export function useModalStyles(): ModalProps['styles'] {
  return glassModalStyles
}
