import styles from './StarInput.module.css'
import { sfx } from '../../audio/sounds'

interface Props {
  value: number
  onChange: (val: number) => void
  max?: number
  label?: string
  disabled?: boolean
}

export function StarInput({ value, onChange, max = 5, label, disabled = false }: Props) {
  function handleClick(starIdx: number) {
    if (disabled) return
    onChange(starIdx)
    sfx.starFill(starIdx)
  }

  return (
    <div className={styles.wrapper}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={styles.stars}>
        {Array.from({ length: max }, (_, i) => {
          const star = i + 1
          const filled = value >= star

          return (
            <div
              key={star}
              className={[styles.star, disabled ? styles.disabled : ''].join(' ')}
              onClick={() => handleClick(star)}
            >
              <span className={filled ? styles.full : styles.empty}>★</span>
            </div>
          )
        })}
      </div>
      <span className={styles.value}>{value > 0 ? value : '—'}</span>
    </div>
  )
}
