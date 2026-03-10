import React from 'react'
import styles from './ArcadeFrame.module.css'

interface Props {
  children: React.ReactNode
  title?: string
  subtitle?: string
  className?: string
}

export function ArcadeFrame({ children, title, subtitle, className }: Props) {
  return (
    <div className={[styles.frame, className ?? ''].join(' ')}>
      {(title || subtitle) && (
        <div className={styles.header}>
          {title    && <h1 className={styles.title}>{title}</h1>}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      )}
      <div className={styles.content}>{children}</div>
    </div>
  )
}
