import { useEffect, useState } from 'react'
import styles from './Rating.module.css'
import { ArcadeButton } from '../../components/ui/ArcadeButton'
import { ArcadeFrame } from '../../components/layout/ArcadeFrame'
import { StarInput } from '../../components/ui/StarInput'
import { PlayerAvatar } from '../../components/game/PlayerAvatar'
import { upsertRating, getRatingsForLobby } from '../../services/ratingService'
import { savePowerScores, generateBracket, openMatch } from '../../services/bracketService'
import { getWeaponsForLobby } from '../../services/setsService'
import { updateLobbyStatus, emitLobbyEvent } from '../../services/lobbyService'
import { getPlayersForLobby } from '../../services/playerService'
import { useSession } from '../../hooks/useSession'
import { useIsHost } from '../../hooks/useIsHost'
import { useGameStore } from '../../store'
import { useLobbyRealtime } from '../../hooks/useLobbyRealtime'
import { useLobbyMusic } from '../../hooks/useAudio'
import { useT } from '../../i18n'
import type { Player } from '../../types/game'

export function RatingPage() {
  const sessionId = useSession()
  const isHost    = useIsHost()
  const { lobby, players, setPlayers, ratings, setRatings, setPowerScores, setBrackets, setWeapons, setActiveMatchId } = useGameStore()
  useLobbyRealtime(lobby?.id ?? null)
  useLobbyMusic('rating')
  const t = useT()

  const me = players.find(p => p.session_id === sessionId)
  const targets = players // Rate everyone including yourself

  const [currentIdx, setCurrentIdx] = useState(0)
  const [strength, setStrength]     = useState(0)
  const [skill, setSkill]           = useState(0)
  const [resistance, setResistance] = useState(0)
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState('')
  const [closing, setClosing]       = useState(false)
  const [done, setDone]             = useState(false)

  const current: Player | undefined = targets[currentIdx]

  // Load players + ratings on mount (guests may not have players in store)
  useEffect(() => {
    if (!lobby) return
    getPlayersForLobby(lobby.id).then(setPlayers)
    getRatingsForLobby(lobby.id).then(setRatings)
  }, [lobby?.id])

  // Pre-fill if existing rating
  useEffect(() => {
    if (!current || !me) return
    const existing = ratings.find(r => r.rater_id === me.id && r.target_id === current.id)
    if (existing) {
      setStrength(existing.strength)
      setSkill(existing.skill)
      setResistance(existing.resistance)
    } else {
      setStrength(0); setSkill(0); setResistance(0)
    }
  }, [currentIdx, current?.id])

  const myRatings = ratings.filter(r => r.rater_id === me?.id)
  const ratedIds  = new Set(myRatings.map(r => r.target_id))
  const allDone   = targets.every(t => ratedIds.has(t.id))

  async function handleSave() {
    if (!lobby || !me || !current || !strength || !skill || !resistance) return
    setSaving(true)
    setSaveError('')
    try {
      await upsertRating(lobby.id, me.id, current.id, strength, skill, resistance)
      if (currentIdx < targets.length - 1) {
        setCurrentIdx(i => i + 1)
      } else {
        setDone(true)
      }
    } catch (e) {
      console.error(e)
      setSaveError(t('rating.saveError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleCloseRatings() {
    if (!lobby || !isHost) return
    setClosing(true)
    try {
      const allPlayers = players.map(p => p.id)
      const scores = await savePowerScores(allPlayers, lobby.id)
      setPowerScores(scores)

      const weapons = await getWeaponsForLobby(lobby.weapon_set_id)
      setWeapons(weapons)

      const brackets = await generateBracket(lobby.id, scores, weapons)
      setBrackets(brackets)

      // Auto-open first match of round 1 and go straight to voting
      const firstMatch = brackets
        .filter(b => b.round_number === 1)
        .find(b => b.player1_id && b.player2_id)

      if (firstMatch) {
        await openMatch(firstMatch.id)
        setActiveMatchId(firstMatch.id)
        await updateLobbyStatus(lobby.id, 'voting')
        await emitLobbyEvent(lobby.id, 'match_opened', { match_id: firstMatch.id })
      } else {
        await updateLobbyStatus(lobby.id, 'bracket')
        await emitLobbyEvent(lobby.id, 'bracket_generated', {})
      }
    } finally {
      setClosing(false)
    }
  }

  // Count who has completed ratings
  const humanPlayers  = players.filter(p => p.player_type === 'human')
  const completedCount = humanPlayers.filter(hp => {
    const rated = ratings.filter(r => r.rater_id === hp.id)
    return rated.length >= targets.length || (hp.session_id === sessionId && allDone)
  }).length

  return (
    <div className={styles.page}>
      <ArcadeFrame title={t('rating.title')} subtitle={t('rating.subtitle')}>
        {done ? (
          <div className={styles.doneState}>
            <p className="display-text-green text-display" style={{ fontSize: 20 }}>{t('rating.submitted')}</p>
            <p className="text-ui text-dim mt-md">{t('rating.waiting')}</p>
            <p className="text-ui mt-md">{t('rating.playersDone', { n: completedCount, total: humanPlayers.length })}</p>
            {isHost && (
              <ArcadeButton
                variant="yellow"
                loading={closing}
                onClick={handleCloseRatings}
                className="mt-xl"
              >
                {t('rating.closeBtn')}
              </ArcadeButton>
            )}
          </div>
        ) : current ? (
          <div className={styles.ratingCard}>
            <div className={styles.progress}>
              {targets.map((target, i) => (
                <div
                  key={target.id}
                  className={[
                    styles.progressDot,
                    ratedIds.has(target.id) ? styles.rated : '',
                    i === currentIdx ? styles.active : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setCurrentIdx(i)}
                />
              ))}
            </div>

            <div className={styles.targetDisplay}>
              <PlayerAvatar player={current} size="xl" />
              <h2 className={styles.targetName}>{current.name}</h2>
              {current.player_type === 'bot' && (
                <span className="text-blue text-ui">{t('rating.botLabel')}</span>
              )}
            </div>

            <div className={styles.stats}>
              <StarInput label={t('rating.strength')}   value={strength}   onChange={setStrength} />
              <StarInput label={t('rating.skill')}      value={skill}      onChange={setSkill} />
              <StarInput label={t('rating.resistance')} value={resistance} onChange={setResistance} />
            </div>

            <div className={styles.navRow}>
              <ArcadeButton
                size="sm"
                variant="ghost"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx(i => i - 1)}
              >
                {t('rating.prev')}
              </ArcadeButton>
              <ArcadeButton
                variant={ratedIds.has(current.id) ? 'green' : 'yellow'}
                loading={saving}
                disabled={!me || !strength || !skill || !resistance}
                onClick={handleSave}
              >
                {ratedIds.has(current.id) ? t('rating.update') : t('rating.rate')}
              </ArcadeButton>
            </div>
            {saveError && <p className="text-red text-ui mt-sm" style={{ fontSize: '0.9rem' }}>{saveError}</p>}
          </div>
        ) : (
          <p className="text-ui text-dim">{t('rating.noPlayers')}</p>
        )}
      </ArcadeFrame>
    </div>
  )
}
