import styles from './PlayerAvatar.module.css'
import type { Player } from '../../types/game'

interface Props {
  player: Player
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showName?: boolean
  eliminated?: boolean
  highlight?: 'yellow' | 'red' | 'blue' | 'green'
}

export function PlayerAvatar({ player, size = 'md', showName = false, eliminated, highlight }: Props) {
  const initials = player.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className={[styles.wrapper, styles[size]].join(' ')}>
      <div className={[
        styles.avatar,
        eliminated ? styles.eliminated : '',
        highlight ? styles[`hl_${highlight}`] : '',
      ].filter(Boolean).join(' ')}>
        {player.photo_url
          ? <img src={player.photo_url} alt={player.name} className={styles.photo} />
          : <span className={styles.initials}>{initials}</span>
        }
        {player.player_type === 'bot' && (
          <span className={styles.botBadge}>BOT</span>
        )}
        {eliminated && <span className={styles.koOverlay}>KO</span>}
      </div>
      {showName && (
        <span className={styles.name}>{player.name}</span>
      )}
    </div>
  )
}
