import React from 'react'
import styles from './AppLayout.module.css'
import { useAudioUnlock } from '../../hooks/useAudio'
import { ConnectionBanner } from '../ui/ConnectionBanner'

interface Props {
  children: React.ReactNode
}

export function AppLayout({ children }: Props) {
  useAudioUnlock()

  return (
    <div className={styles.root}>
      <ConnectionBanner />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
