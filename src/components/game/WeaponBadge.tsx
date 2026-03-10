import styles from './WeaponBadge.module.css'
import type { Weapon } from '../../types/game'
import { dangerToStars } from '../../lib/utils'

interface Props {
  weapon: Weapon
  showDanger?: boolean
}

export function WeaponBadge({ weapon, showDanger = true }: Props) {
  const stars = dangerToStars(weapon.danger_level)
  const dangerColor = weapon.danger_level >= 8 ? 'red'
    : weapon.danger_level >= 5 ? 'yellow'
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
            {'★'.repeat(Math.floor(stars))}
            {stars % 1 >= 0.5 ? '½' : ''}
            {'☆'.repeat(5 - Math.ceil(stars))}
          </span>
        )}
      </div>
    </div>
  )
}
