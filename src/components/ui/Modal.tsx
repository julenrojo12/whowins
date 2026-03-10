import React, { useEffect } from 'react'
import styles from './Modal.module.css'

interface Props {
  isOpen: boolean
  onClose?: () => void
  title?: string
  children: React.ReactNode
}

export function Modal({ isOpen, onClose, title, children }: Props) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {title && (
          <div className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            {onClose && (
              <button className={styles.closeBtn} onClick={onClose}>✕</button>
            )}
          </div>
        )}
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}
