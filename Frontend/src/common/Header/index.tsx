import { useState, useEffect, useCallback } from 'react'
import { FullscreenOutlined, FullscreenExitOutlined, HomeOutlined } from '@ant-design/icons'
import { message } from 'antd'
import { useNavigate } from 'react-router-dom'
import styles from './styles.module.less'

function MoleculeIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle cx="18" cy="18" r="18" fill="#5aa3a1" opacity="0.12" />
      <circle cx="18" cy="18" r="5" fill="#5aa3a1" />
      <circle cx="9"  cy="10" r="3" fill="#5aa3a1" opacity="0.85" />
      <circle cx="27" cy="10" r="3" fill="#5aa3a1" opacity="0.85" />
      <circle cx="9"  cy="26" r="3" fill="#5aa3a1" opacity="0.85" />
      <circle cx="27" cy="26" r="3" fill="#5aa3a1" opacity="0.85" />
      <line x1="18" y1="18" x2="9"  y2="10" stroke="#5aa3a1" strokeWidth="1.5" opacity="0.6" />
      <line x1="18" y1="18" x2="27" y2="10" stroke="#5aa3a1" strokeWidth="1.5" opacity="0.6" />
      <line x1="18" y1="18" x2="9"  y2="26" stroke="#5aa3a1" strokeWidth="1.5" opacity="0.6" />
      <line x1="18" y1="18" x2="27" y2="26" stroke="#5aa3a1" strokeWidth="1.5" opacity="0.6" />
    </svg>
  )
}

export default function Header() {
  const navigate = useNavigate()
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const sync = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      message.error('Fullscreen is not available in this browser')
    }
  }, [])

  return (
    <header className={styles.header}>
      {/* Logo — click to go to dashboard */}
      <div
        className={styles.logo}
        style={{ cursor: 'pointer' }}
        onClick={() => { localStorage.removeItem('chemia_module'); navigate('/dashboard') }}
      >
        <div className={styles.logoIcon}><MoleculeIcon /></div>
        <div className={styles.logoText}>
          <span className={styles.logoTitle}>
            Chemia <span className={styles.logoAt}>@ Cchance</span>
          </span>
          <span className={styles.logoSub}>CHEMIA RESEARCH</span>
        </div>
      </div>

      <nav className={styles.nav}>
        {/* <button
          className={styles.navItem}
          title="Home"
          onClick={() => { localStorage.removeItem('chemia_module'); navigate('/dashboard') }}
        >
          <HomeOutlined className={styles.navIcon} />
          <span className={styles.navLabel}>Home</span>
        </button> */}

        <button
          className={styles.navItem}
          title={isFullscreen ? 'Exit full screen' : 'Full screen'}
          onClick={toggleFullscreen}
        >
          {isFullscreen
            ? <FullscreenExitOutlined className={styles.navIcon} />
            : <FullscreenOutlined className={styles.navIcon} />}
          <span className={styles.navLabel}>
            {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          </span>
        </button>

        {/* Password, About, Alerts — commented out, moved to sidebar profile */}
        {/* <button className={styles.navItem} onClick={() => setCpOpen(true)}>Password</button> */}
        {/* <button className={styles.navItem}>About</button> */}
        {/* <button className={styles.navItem}>Alerts</button> */}
      </nav>
    </header>
  )
}
