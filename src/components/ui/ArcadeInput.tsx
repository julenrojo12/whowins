import React from 'react'
import styles from './ArcadeInput.module.css'

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function ArcadeInput({ label, error, className, ...rest }: Props) {
  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}
      <input className={[styles.input, error ? styles.hasError : '', className ?? ''].filter(Boolean).join(' ')} {...rest} />
      {error && <span className={styles.error}>{error}</span>}
    </div>
  )
}
