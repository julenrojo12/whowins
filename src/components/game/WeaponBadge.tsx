import styles from './WeaponBadge.module.css'
import type { Weapon } from '../../types/game'

interface Props {
  weapon: Weapon
  showDanger?: boolean
}

export function WeaponBadge({ weapon, showDanger = true }: Props) {
  const stars = weapon.danger_level  // 1-5
  const dangerColor = stars >= 4 ? 'red'
    : stars >= 3 ? 'yellow'
    : 'green'

  return (
    <div className={[styles.badge, styles[`danger_${dangerColor}`]].join(' ')}>
      {weapon.image_url
        ? <img src={weapon.image_url} alt={weapon.name} className={styles.img} />
        : <span className={styles.icon}>⚔</span>
      }
      <div className={styles.info}>
        <span className={styles.name}>{weapon.name}</span>
        {showDanger && (
          <span className={styles.danger}>
            {'★'.repeat(stars)}
            {'☆'.repeat(5 - stars)}
          </span>
        )}
      </div>
    </div>
  )
}
