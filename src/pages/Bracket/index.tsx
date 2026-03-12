import { useEffect, useState } from 'react'
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
      lobby.weapon_set_id ? getWeaponsForLobby(lobby.weapon_set_id).then(setWeapons) : Promise.resolve(),
    ]).finally(() => setLoading(false))
  }, [lobby?.id, lobby?.status])

  const rounds = [...new Set(brackets.map(b => b.round_number))].sort()

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

  const totalRounds = rounds.length
  const isFinalRound = (r: number) => r === rounds[totalRounds - 1] && totalRounds > 1

  return (
    <div className={styles.page}>
      <ArcadeFrame title={t('bracket.title')}>
        {/* Host start-round button */}
        {isHost && canStartRound && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-sm)', padding: '0 0 var(--space-lg)' }}>
            <ArcadeButton variant="red" size="lg" loading={starting} onClick={handleStartRound}>
              {isFinalRound(nextRound) ? t('bracket.startFinal') : t('bracket.startRound', { n: nextRound })}
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
                  {isFinalRound(nextRound) ? t('bracket.startFinal') : t('bracket.startRound', { n: nextRound })}
                </ArcadeButton>
            }
            {startError && !loading && (
              <p className="text-ui" style={{ color: 'var(--color-primary)', fontSize: '0.9rem' }}>
                {t('bracket.startError')}
              </p>
            )}
          </div>
        )}
        {!isHost && !canStartRound && (
          <p className="text-ui text-dim text-center" style={{ paddingBottom: 'var(--space-lg)' }}>
            {t('bracket.waitingHost')}
          </p>
        )}

        <div className={styles.bracket}>
          {[nextRound].filter(round => byRound[round]).map(round => (
            <div key={round} className={styles.round}>
              <h3 className={styles.roundTitle}>
                {isFinalRound(round) ? t('bracket.final') : t('bracket.round', { n: round })}
              </h3>
              <div className={styles.matches}>
                {byRound[round]?.map(match => {
                  const p1 = getPlayer(match.player1_id)
                  const p2 = getPlayer(match.player2_id)
                  const w1 = getWeapon(match.weapon1_id)
                  const w2 = getWeapon(match.weapon2_id)

                  return (
                    <div
                      key={match.id}
                      className={[
                        styles.matchCard,
                        match.status === 'open'   ? styles.open   : '',
                        match.status === 'closed' ? styles.closed : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <div className={styles.fighter}>
                        {p1 ? <PlayerAvatar player={p1} size="sm" showName eliminated={p1.is_eliminated} /> : <span className={styles.tbd}>{t('bracket.tbd')}</span>}
                        {w1 && <WeaponBadge weapon={w1} />}
                      </div>
                      <div className={styles.vs}>
                        {match.status === 'closed' && match.winner_id
                          ? <span className="display-text-primary text-display" style={{ fontSize: 14 }}>{t('bracket.winner')}</span>
                          : <span className={styles.vsText}>VS</span>
                        }
                        {match.winner_id && (
                          <span className="text-green text-ui" style={{ fontSize: '0.9rem' }}>
                            {getPlayer(match.winner_id)?.name}
                          </span>
                        )}
                      </div>
                      <div className={styles.fighter}>
                        {p2 ? <PlayerAvatar player={p2} size="sm" showName eliminated={p2.is_eliminated} /> : <span className={styles.tbd}>{t('bracket.tbd')}</span>}
                        {w2 && <WeaponBadge weapon={w2} />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </ArcadeFrame>
    </div>
  )
}
