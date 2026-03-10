import React from 'react'
import styles from './AppLayout.module.css'
import { useAudioUnlock } from '../../hooks/useAudio'

interface Props {
  children: React.ReactNode
}

export function AppLayout({ children }: Props) {
  useAudioUnlock()

  return (
    <div className={styles.root}>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
