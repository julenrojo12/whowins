import React from 'react'
import styles from './ArcadeButton.module.css'
import { sfx } from '../../audio/sounds'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'yellow' | 'red' | 'blue' | 'green' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function ArcadeButton({
  children,
  variant = 'yellow',
  size = 'md',
  loading = false,
  disabled,
  onClick,
  className,
  ...rest
}: Props) {
  const cls = [
    styles.btn,
    styles[variant],
    styles[size],
    loading ? styles.loading : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    sfx.menuConfirm()
    onClick?.(e)
  }

  function handleMouseEnter() {
    sfx.menuSelect()
  }

  return (
    <button
      className={cls}
      disabled={disabled || loading}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      {...rest}
    >
      {loading ? <span className={styles.spinner}>▓</span> : children}
    </button>
  )
}
