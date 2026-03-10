import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Results.module.css'
import { ArcadeButton } from '../../components/ui/ArcadeButton'
import { PlayerAvatar } from '../../components/game/PlayerAvatar'
import { getBrackets } from '../../services/bracketService'
import { useGameStore } from '../../store'
import { sfx } from '../../audio/sounds'
import { useT } from '../../i18n'
import type { Player } from '../../types/game'

export function ResultsPage() {
  const navigate = useNavigate()
  const { lobby, players, brackets, setBrackets } = useGameStore()
  const [showWinner, setShowWinner] = useState(false)
  const t = useT()

  useEffect(() => {
    if (!lobby) return
    getBrackets(lobby.id).then(setBrackets)
    setTimeout(() => {
      sfx.winner()
      setShowWinner(true)
    }, 800)
  }, [lobby?.id])

  // Find the final match winner
  const finalMatch = brackets
    .filter(b => b.status === 'closed' && b.winner_id)
    .sort((a, b) => b.round_number - a.round_number)[0]

  const champion: Player | undefined = players.find(p => p.id === finalMatch?.winner_id)

  const rounds = [...new Set(brackets.map(b => b.round_number))].sort()

  return (
    <div className={styles.page}>
      {/* Winner reveal */}
      {showWinner && champion && (
        <div className={styles.championSection}>
          <div className={styles.crownRow}>
            <span className={styles.crown}>👑</span>
          </div>
          <div className={styles.winnerGlow}>
            <PlayerAvatar player={champion} size="xl" highlight="yellow" />
          </div>
          <h1 className={styles.winnerName}>{champion.name}</h1>
          <p className={styles.winnerLabel}>{t('results.champion')}</p>
        </div>
      )}

      {/* Bracket recap */}
      <div className={styles.recap}>
        <h2 className={styles.recapTitle}>{t('results.recap')}</h2>
        {rounds.map(round => (
          <div key={round} className={styles.roundSection}>
            <h3 className={styles.roundLabel}>
              {round === rounds[rounds.length - 1] && rounds.length > 1
                ? t('results.final')
                : t('results.round', { n: round })}
            </h3>
            {brackets.filter(b => b.round_number === round).map(match => {
              const p1 = players.find(p => p.id === match.player1_id)
              const p2 = players.find(p => p.id === match.player2_id)
              const winner = players.find(p => p.id === match.winner_id)
              return (
                <div key={match.id} className={styles.recapMatch}>
                  <span className={[styles.recapPlayer, match.winner_id === p1?.id ? styles.recapWinner : ''].join(' ')}>
                    {p1?.name ?? 'TBD'}
                  </span>
                  <span className={styles.recapVs}>{t('results.vs')}</span>
                  <span className={[styles.recapPlayer, match.winner_id === p2?.id ? styles.recapWinner : ''].join(' ')}>
                    {p2?.name ?? 'TBD'}
                  </span>
                  {winner && <span className={styles.recapResult}>→ {winner.name}</span>}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <ArcadeButton variant="yellow" size="lg" onClick={() => navigate('/')}>
        {t('results.playAgain')}
      </ArcadeButton>
    </div>
  )
}
