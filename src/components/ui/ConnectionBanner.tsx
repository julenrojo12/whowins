import { useGameStore } from '../../store'
import styles from './ConnectionBanner.module.css'

export function ConnectionBanner() {
  const status = useGameStore(s => s.connectionStatus)
  if (status === 'connected') return null

  return (
    <div className={`${styles.banner} ${styles[status]}`} role="status" aria-live="polite">
      {status === 'reconnecting' && (
        <>
          <span className={styles.spinner}>↻</span>
          Reconnecting...
        </>
      )}
      {status === 'disconnected' && 'Connection lost'}
    </div>
  )
}
