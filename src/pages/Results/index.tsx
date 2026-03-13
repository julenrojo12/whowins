import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Results.module.css'
import { ArcadeButton } from '../../components/ui/ArcadeButton'
import { Modal } from '../../components/ui/Modal'
import { PlayerAvatar } from '../../components/game/PlayerAvatar'
import { getBrackets } from '../../services/bracketService'
import { replayWithAttributes } from '../../services/lobbyService'
import { getCharacterSets, getWeaponSets } from '../../services/setsService'
import { useGameStore } from '../../store'
import { useIsHost } from '../../hooks/useIsHost'
import { useLobbyRealtime } from '../../hooks/useLobbyRealtime'
import { sfx } from '../../audio/sounds'
import { useT } from '../../i18n'
import type { Player, CharacterSet, WeaponSet } from '../../types/game'

export function ResultsPage() {
  const navigate = useNavigate()
  const { lobby, players, brackets, setBrackets } = useGameStore()
  const isHost = useIsHost()
  const [showWinner, setShowWinner] = useState(false)
  const [showReplay, setShowReplay] = useState(false)
  const [charSets, setCharSets] = useState<CharacterSet[]>([])
  const [weapSets, setWeapSets] = useState<WeaponSet[]>([])
  const [charSetId, setCharSetId] = useState('')
  const [weapSetId, setWeapSetId] = useState('')
  const [loadingSets, setLoadingSets] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const t = useT()

  useLobbyRealtime(lobby?.id ?? null)

  useEffect(() => {
    if (!lobby) return
    getBrackets(lobby.id).then(setBrackets)
    setTimeout(() => {
      sfx.winner()
      setShowWinner(true)
    }, 800)
  }, [lobby?.id])

  async function openReplay() {
    setShowReplay(true)
    setLoadingSets(true)
    try {
      const [cs, ws] = await Promise.all([getCharacterSets(), getWeaponSets()])
      setCharSets(cs)
      setWeapSets(ws)
      setCharSetId(lobby?.character_set_id ?? cs[0]?.id ?? '')
      setWeapSetId(lobby?.weapon_set_id ?? ws[0]?.id ?? '')
    } finally {
      setLoadingSets(false)
    }
  }

  async function handleReplay() {
    if (!lobby || !charSetId || !weapSetId) return
    setReplaying(true)
    try {
      const playerIds = players.map(p => p.id)
      await replayWithAttributes(lobby.id, weapSetId, charSetId, playerIds)
      // Navigation driven automatically by realtime lobby status change
    } catch (e) {
      console.error(e)
      setReplaying(false)
    }
  }

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

      <div className={styles.actions}>
        {isHost && (
          <ArcadeButton variant="red" size="lg" onClick={openReplay}>
            {t('results.playAgainKeep')}
          </ArcadeButton>
        )}
        <ArcadeButton variant="yellow" size="lg" onClick={() => navigate('/')}>
          {t('results.playAgain')}
        </ArcadeButton>
      </div>

      {/* Replay modal — host selects new sets, ratings are preserved */}
      <Modal
        isOpen={showReplay}
        onClose={() => { if (!replaying) setShowReplay(false) }}
        title={t('results.replayTitle')}
      >
        {loadingSets ? (
          <p className="text-dim text-ui">{t('home.loadingSets')}</p>
        ) : (
          <div className={styles.replayForm}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>{t('home.characterSet')}</label>
              <select
                className={styles.select}
                value={charSetId}
                onChange={e => setCharSetId(e.target.value)}
              >
                {charSets.map(cs => (
                  <option key={cs.id} value={cs.id}>{cs.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>{t('home.weaponSet')}</label>
              <select
                className={styles.select}
                value={weapSetId}
                onChange={e => setWeapSetId(e.target.value)}
              >
                {weapSets.map(ws => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
            </div>

            <ArcadeButton
              variant="yellow"
              loading={replaying}
              disabled={!charSetId || !weapSetId}
              onClick={handleReplay}
            >
              {t('results.confirmReplay')}
            </ArcadeButton>
          </div>
        )}
      </Modal>
    </div>
  )
}
