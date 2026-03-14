import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Bracket.module.css'
import { ArcadeButton } from '../../components/ui/ArcadeButton'
import { ArcadeFrame } from '../../components/layout/ArcadeFrame'
import { PlayerAvatar } from '../../components/game/PlayerAvatar'
import { WeaponBadge } from '../../components/game/WeaponBadge'
import { getBrackets, openMatch } from '../../services/bracketService'
import { updateLobbyStatus, emitLobbyEvent } from '../../services/lobbyService'
import { getPlayersForLobby } from '../../services/playerService'
import { getWeaponsForLobby } from '../../services/setsService'
import { useIsHost } from '../../hooks/useIsHost'
import { useGameStore } from '../../store'
import { useLobbyRealtime } from '../../hooks/useLobbyRealtime'
import { useLobbyMusic } from '../../hooks/useAudio'
import { useT } from '../../i18n'
import type { BracketMatch } from '../../types/game'

export function BracketPage() {
  const navigate  = useNavigate()
  const isHost    = useIsHost()
  const { lobby, players, setPlayers, brackets, setBrackets, weapons, setWeapons, setActiveMatchId } = useGameStore()
  useLobbyRealtime(lobby?.id ?? null)
  useLobbyMusic('battle')
  const t = useT()

  const [starting, setStarting]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [startError, setStartError] = useState(false)

  useEffect(() => {
    if (!lobby) return
    setLoading(true)
    Promise.all([
      getBrackets(lobby.id).then(setBrackets),
      getPlayersForLobby(lobby.id).then(setPlayers),
      getWeaponsForLobby(lobby.weapon_set_id).then(setWeapons),
    ]).finally(() => setLoading(false))
  }, [lobby?.id, lobby?.status])

  const rounds = [...new Set(brackets.map(b => b.round_number))].sort()
  const totalRounds = rounds.length

  function getPlayer(id: string | null) {
    return players.find(p => p.id === id) ?? null
  }

  function getWeapon(id: string | null) {
    return weapons.find(w => w.id === id) ?? null
  }

  // current_round is the NEXT round to play (set by advanceWinners)
  const nextRound = lobby?.current_round ?? 1

  const nextRoundMatches = brackets.filter(b =>
    b.round_number === nextRound && b.status === 'pending'
  )
  const canStartRound = isHost && nextRoundMatches.length > 0

  // Determine round label based on how far from the final
  function getRoundLabel(round: number): string {
    const stepsFromFinal = totalRounds - round
    if (stepsFromFinal === 0) return t('bracket.final')
    if (stepsFromFinal === 1) return t('bracket.semis')
    if (stepsFromFinal === 2) return t('bracket.quarters')
    return t('bracket.round', { n: round })
  }

  function getStartButtonText(): string {
    const stepsFromFinal = totalRounds - nextRound
    if (stepsFromFinal === 0) return t('bracket.startFinal')
    if (stepsFromFinal === 1) return t('bracket.startSemis')
    if (stepsFromFinal === 2) return t('bracket.startQuarters')
    return t('bracket.startRound', { n: nextRound })
  }

  function getWaitingText(): string {
    const stepsFromFinal = totalRounds - nextRound
    if (stepsFromFinal === 0) return t('bracket.waitingFinal')
    if (stepsFromFinal === 1) return t('bracket.waitingSemis')
    if (stepsFromFinal === 2) return t('bracket.waitingQuarters')
    return t('bracket.waitingHost')
  }

  async function handleStartRound() {
    if (!lobby) return
    setStarting(true)
    setStartError(false)
    try {
      const freshBrackets = await getBrackets(lobby.id)
      setBrackets(freshBrackets)

      const firstMatch = freshBrackets.find(b =>
        b.round_number === nextRound &&
        b.status === 'pending' &&
        b.player1_id && b.player2_id
      )
      if (!firstMatch) {
        setStartError(true)
        return
      }

      await openMatch(firstMatch.id)
      setActiveMatchId(firstMatch.id)
      await updateLobbyStatus(lobby.id, 'voting')
      await emitLobbyEvent(lobby.id, 'match_opened', { match_id: firstMatch.id })
      // Navigate directly instead of waiting for the realtime lobby-change event.
      // This prevents the host from being stuck when the channel was not yet
      // subscribed when the 'voting' event fired (the race-condition bug).
      navigate('/match', { replace: true })
    } catch {
      setStartError(true)
    } finally {
      setStarting(false)
    }
  }

  // Group brackets by round
  const byRound = rounds.reduce<Record<number, BracketMatch[]>>((acc, r) => {
    acc[r] = brackets.filter(b => b.round_number === r)
    return acc
  }, {})

  // Only show rounds that have already been played (results, no spoilers)
  const completedRounds = rounds.filter(r => r < nextRound)

  return (
    <div className={styles.page}>
      <ArcadeFrame title={t('bracket.title')}>
        {/* Host start-round button */}
        {isHost && canStartRound && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-sm)', padding: '0 0 var(--space-lg)' }}>
            <ArcadeButton variant="red" size="lg" loading={starting} onClick={handleStartRound}>
              {getStartButtonText()}
            </ArcadeButton>
            {startError && (
              <p className="text-ui" style={{ color: 'var(--color-primary)', fontSize: '0.9rem' }}>
                {t('bracket.startError')}
              </p>
            )}
          </div>
        )}
        {isHost && !canStartRound && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-sm)', padding: '0 0 var(--space-lg)' }}>
            {loading
              ? <p className="text-ui text-dim text-center">{t('bracket.preparingRound')}</p>
              : <ArcadeButton variant="red" size="lg" loading={starting} onClick={handleStartRound}>
                  {getStartButtonText()}
                </ArcadeButton>
            }
            {startError && !loading && (
              <p className="text-ui" style={{ color: 'var(--color-primary)', fontSize: '0.9rem' }}>
                {t('bracket.startError')}
              </p>
            )}
          </div>
        )}
        {!isHost && (
          <p className="text-ui text-dim text-center" style={{ paddingBottom: 'var(--space-lg)' }}>
            {getWaitingText()}
          </p>
        )}

        {/* Previous rounds results */}
        {completedRounds.length > 0 && (
          <div className={styles.bracket}>
            {completedRounds.map(round => (
              <div key={round} className={styles.round}>
                <h3 className={styles.roundTitle}>{getRoundLabel(round)}</h3>
                <div className={styles.matches}>
                  {byRound[round]?.map(match => {
                    const p1 = getPlayer(match.player1_id)
                    const p2 = getPlayer(match.player2_id)
                    const p3 = getPlayer(match.player3_id ?? null)
                    const p4 = getPlayer(match.player4_id ?? null)
                    const w1 = getWeapon(match.weapon1_id)
                    const w2 = getWeapon(match.weapon2_id)
                    const w3 = getWeapon(match.weapon3_id ?? null)
                    const w4 = getWeapon(match.weapon4_id ?? null)
                    const is2v2Match = !!(match.player3_id && match.player4_id)
                    const teamAWon = match.winner_id === match.player1_id
                    const teamBWon = match.winner_id === match.player2_id

                    return (
                      <div
                        key={match.id}
                        className={[
                          styles.matchCard,
                          match.status === 'closed' ? styles.closed : '',
                        ].filter(Boolean).join(' ')}
                      >
                        {/* Team A / Player 1 side */}
                        <div className={[(is2v2Match ? (teamAWon ? styles.winnerFighter : styles.loserFighter) : (match.winner_id === match.player1_id ? styles.winnerFighter : styles.loserFighter)), styles.fighter].filter(Boolean).join(' ')}>
                          {p1 ? <PlayerAvatar player={p1} size="sm" showName eliminated={p1.is_eliminated} /> : <span className={styles.tbd}>{t('bracket.tbd')}</span>}
                          {w1 && <WeaponBadge weapon={w1} />}
                          {/* 2v2: second team A member */}
                          {is2v2Match && p3 && (
                            <div className={styles.teamMateSmall}>
                              <PlayerAvatar player={p3} size="sm" showName eliminated={p3.is_eliminated} />
                              {w3 && <WeaponBadge weapon={w3} />}
                            </div>
                          )}
                        </div>

                        <div className={styles.vs}>
                          {match.winner_id
                            ? <span className="display-text-primary text-display" style={{ fontSize: 14 }}>{t('bracket.winner')}</span>
                            : <span className={styles.vsText}>VS</span>
                          }
                          {match.winner_id && !is2v2Match && (
                            <span className="text-green text-ui" style={{ fontSize: '0.9rem' }}>
                              {getPlayer(match.winner_id)?.name}
                            </span>
                          )}
                          {match.winner_id && is2v2Match && (
                            <span className="text-green text-ui" style={{ fontSize: '0.9rem' }}>
                              {teamAWon ? `${p1?.name} & ${p3?.name}` : `${p2?.name} & ${p4?.name}`}
                            </span>
                          )}
                        </div>

                        {/* Team B / Player 2 side */}
                        <div className={[(is2v2Match ? (teamBWon ? styles.winnerFighter : styles.loserFighter) : (match.winner_id === match.player2_id ? styles.winnerFighter : styles.loserFighter)), styles.fighter].filter(Boolean).join(' ')}>
                          {p2 ? <PlayerAvatar player={p2} size="sm" showName eliminated={p2.is_eliminated} /> : <span className={styles.tbd}>{t('bracket.tbd')}</span>}
                          {w2 && <WeaponBadge weapon={w2} />}
                          {/* 2v2: second team B member */}
                          {is2v2Match && p4 && (
                            <div className={styles.teamMateSmall}>
                              <PlayerAvatar player={p4} size="sm" showName eliminated={p4.is_eliminated} />
                              {w4 && <WeaponBadge weapon={w4} />}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </ArcadeFrame>
    </div>
  )
}
