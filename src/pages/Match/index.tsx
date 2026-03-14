import { useEffect, useRef, useState } from 'react'
import styles from './Match.module.css'
import { ArcadeButton } from '../../components/ui/ArcadeButton'
import { ArcadeFrame } from '../../components/layout/ArcadeFrame'
import { PlayerAvatar } from '../../components/game/PlayerAvatar'
import { WeaponBadge } from '../../components/game/WeaponBadge'
import { castVote, getVotesForBracket, determineWinner, determineWinner2v2 } from '../../services/voteService'
import { closeMatch, getBrackets, advanceWinners, advanceWinners2v2, openMatch as openBracketMatch } from '../../services/bracketService'
import { eliminatePlayer, getPlayersForLobby } from '../../services/playerService'
import { updateLobbyStatus, emitLobbyEvent } from '../../services/lobbyService'
import { getPowerScores } from '../../services/bracketService'
import { getWeaponsForLobby } from '../../services/setsService'
import { useSession } from '../../hooks/useSession'
import { useIsHost } from '../../hooks/useIsHost'
import { useGameStore } from '../../store'
import { useLobbyRealtime } from '../../hooks/useLobbyRealtime'
import { useLobbyMusic } from '../../hooks/useAudio'
import { sfx } from '../../audio/sounds'
import { supabase } from '../../lib/supabase'
import { useT } from '../../i18n'
import type { BracketMatch, Player, PlayerPowerScore, LobbyEvent } from '../../types/game'

const VOTING_DURATION = 5

function StatBars({ score, side }: { score: PlayerPowerScore; side: 'left' | 'right' }) {
  const t = useT()
  const stats = [
    { label: t('rating.strength'),   icon: '💪', value: score.avg_strength },
    { label: t('rating.skill'),      icon: '🤚', value: score.avg_skill },
    { label: t('rating.resistance'), icon: '🔋', value: score.avg_resistance },
  ]
  return (
    <div className={[styles.statsBlock, side === 'right' ? styles.statsRight : ''].filter(Boolean).join(' ')}>
      {stats.map(({ label, icon, value }) => (
        <div key={label} className={styles.statRow}>
          <span className={styles.statIcon} title={label}>{icon}</span>
          <span className={styles.statLabel}>{label}</span>
          <div className={styles.statBar}>
            <div className={styles.statFill} style={{ width: `${(value / 5) * 100}%` }} />
          </div>
          <span className={styles.statValue}>{value.toFixed(1)}</span>
        </div>
      ))}
    </div>
  )
}

export function MatchPage() {
  const sessionId = useSession()
  const isHost    = useIsHost()
  const { lobby, players, setPlayers, brackets, setBrackets, votes, upsertVote,
          setActiveMatchId, powerScores, setPowerScores, weapons, setWeapons,
          votingStartedEvent, setVotingStartedEvent } = useGameStore()
  useLobbyRealtime(lobby?.id ?? null)
  useLobbyMusic('battle')
  const t = useT()

  const [showFight, setShowFight]       = useState(false)
  const [closing, setClosing]           = useState(false)
  const [winner, setWinner]             = useState<Player | null>(null)
  const [winnerTeam, setWinnerTeam]     = useState<'A' | 'B' | null>(null)
  const [votingStarted, setVotingStarted] = useState(false)
  const [countdown, setCountdown]       = useState<number | null>(null)

  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoClosedRef     = useRef(false)
  // Refs to avoid stale closures in the countdown ticker
  const isHostRef         = useRef(isHost)
  const closingRef        = useRef(closing)
  const winnerRef         = useRef(winner)
  const winnerTeamRef     = useRef(winnerTeam)
  useEffect(() => { isHostRef.current = isHost },         [isHost])
  useEffect(() => { closingRef.current = closing },       [closing])
  useEffect(() => { winnerRef.current = winner },         [winner])
  useEffect(() => { winnerTeamRef.current = winnerTeam }, [winnerTeam])

  // On mount / lobby change: ensure players, weapons, brackets and power scores are loaded.
  // Also re-runs when lobby.status becomes 'voting' (e.g. after a game restart) so that
  // stale brackets from the previous game are replaced with the freshly generated ones.
  useEffect(() => {
    if (!lobby) return
    getPlayersForLobby(lobby.id).then(ps => {
      setPlayers(ps)
      if (ps.length > 0) {
        getPowerScores(ps.map(p => p.id)).then(setPowerScores)
      }
    })
    getWeaponsForLobby(lobby.weapon_set_id).then(setWeapons)
    getBrackets(lobby.id).then(setBrackets)
  }, [lobby?.id, lobby?.status])

  // Find the open match
  const openMatch: BracketMatch | undefined = brackets.find(b => b.status === 'open')

  // ── Countdown logic ──────────────────────────────────────
  function clearCountdownTimer() {
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }

  function startCountdown(from: number) {
    clearCountdownTimer()
    autoClosedRef.current = false
    setVotingStarted(true)

    function tick(n: number) {
      setCountdown(n)
      sfx.countdown(n)
      if (n <= 0) {
        if (isHostRef.current && !autoClosedRef.current && !closingRef.current && !winnerRef.current && !winnerTeamRef.current) {
          autoClosedRef.current = true
          handleCloseMatch()
        }
        return
      }
      countdownTimerRef.current = setTimeout(() => tick(n - 1), 1000)
    }
    tick(from)
  }

  // Reset state when a new match opens
  useEffect(() => {
    if (!openMatch) return
    clearCountdownTimer()
    setVotingStarted(false)
    setCountdown(null)
    autoClosedRef.current = false
    setActiveMatchId(openMatch.id)
    setShowFight(false)
    setWinner(null)
    setWinnerTeam(null)
    setVotingStartedEvent(null)
    sfx.vsSlam()
    setTimeout(() => setShowFight(true), 1000)
  }, [openMatch?.id])

  useEffect(() => {
    if (!openMatch) return
    getVotesForBracket(openMatch.id).then(vs => vs.forEach(upsertVote))
  }, [openMatch?.id])

  // On mount / match change: check if voting_started event already exists (page refresh resilience)
  useEffect(() => {
    if (!openMatch || !lobby) return
    supabase
      .from('lobby_events')
      .select()
      .eq('lobby_id', lobby.id)
      .eq('event_type', 'voting_started')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (!data?.[0]) return
        const event = data[0] as LobbyEvent
        const payload = event.payload as { match_id?: string; started_at?: number }
        if (payload?.match_id !== openMatch.id) return
        const startedAt = payload.started_at ?? 0
        const elapsed   = Math.floor((Date.now() - startedAt) / 1000)
        const remaining = VOTING_DURATION - elapsed
        if (remaining > 0) {
          startCountdown(remaining)
        }
      })
  }, [openMatch?.id])

  // React to voting_started events propagated via useLobbyRealtime → Zustand store
  useEffect(() => {
    if (!votingStartedEvent || !openMatch) return
    if (votingStartedEvent.match_id !== openMatch.id) return
    const elapsed   = Math.floor((Date.now() - votingStartedEvent.started_at) / 1000)
    const remaining = VOTING_DURATION - elapsed
    if (remaining > 0) startCountdown(remaining)
    setVotingStartedEvent(null)
  }, [votingStartedEvent, openMatch?.id])

  // Cleanup timer on unmount
  useEffect(() => () => clearCountdownTimer(), [])

  const is2v2 = lobby?.battle_mode === '2v2'

  const me = players.find(p => p.session_id === sessionId)
  const p1 = players.find(p => p.id === openMatch?.player1_id)
  const p2 = players.find(p => p.id === openMatch?.player2_id)
  const p3 = players.find(p => p.id === openMatch?.player3_id)  // 2v2: team A second
  const p4 = players.find(p => p.id === openMatch?.player4_id)  // 2v2: team B second
  const w1 = weapons.find(w => w.id === openMatch?.weapon1_id)
  const w2 = weapons.find(w => w.id === openMatch?.weapon2_id)
  const w3 = weapons.find(w => w.id === openMatch?.weapon3_id)
  const w4 = weapons.find(w => w.id === openMatch?.weapon4_id)

  const p1Score = powerScores.find(s => s.player_id === p1?.id)
  const p2Score = powerScores.find(s => s.player_id === p2?.id)
  const p3Score = powerScores.find(s => s.player_id === p3?.id)
  const p4Score = powerScores.find(s => s.player_id === p4?.id)

  const matchVotes  = votes.filter(v => v.bracket_id === openMatch?.id)
  const myVote      = matchVotes.find(v => v.voter_id === me?.id)
  const p1Votes     = matchVotes.filter(v => v.voted_for_id === openMatch?.player1_id).length
  const p2Votes     = matchVotes.filter(v => v.voted_for_id === openMatch?.player2_id).length
  const totalVotes  = matchVotes.length || 1

  async function handleVote(playerId: string) {
    if (!openMatch || !me || myVote || !votingStarted || countdown === 0) return
    const vote = await castVote(openMatch.id, me.id, playerId)
    upsertVote(vote)
    sfx.voteCast()
  }

  async function handleStartVoting() {
    if (!openMatch || !lobby || !isHost || votingStarted) return
    await emitLobbyEvent(lobby.id, 'voting_started', {
      match_id:   openMatch.id,
      started_at: Date.now(),
    })
  }

  async function handleCloseMatch() {
    if (!openMatch || !lobby || !isHost) return
    setClosing(true)
    clearCountdownTimer()
    sfx.matchClose()
    try {
      const freshVotes = await getVotesForBracket(openMatch.id)

      let winnerId: string
      let loserIds: string[]

      if (is2v2 && openMatch.player3_id && openMatch.player4_id) {
        const result = determineWinner2v2(freshVotes, openMatch)
        winnerId = result.winnerId
        loserIds = [result.loserId1, result.loserId2]
        await closeMatch(openMatch.id, winnerId)
        for (const loserId of loserIds) await eliminatePlayer(loserId)
        const winnerTeamLabel = winnerId === openMatch.player1_id ? 'A' : 'B'
        setWinnerTeam(winnerTeamLabel)
      } else {
        winnerId = openMatch.player1_id && openMatch.player2_id
          ? determineWinner(freshVotes, openMatch.player1_id, openMatch.player2_id)
          : openMatch.player1_id ?? ''
        const loserId = winnerId === openMatch.player1_id ? openMatch.player2_id : openMatch.player1_id
        await closeMatch(openMatch.id, winnerId)
        if (loserId) await eliminatePlayer(loserId)
        const winnerPlayer = players.find(p => p.id === winnerId) ?? null
        setWinner(winnerPlayer)
      }

      sfx.knockout()

      // Check if round is complete
      const allBrackets  = await getBrackets(lobby.id)
      const currentRound = openMatch.round_number
      const roundMatches = allBrackets.filter(b => b.round_number === currentRound)
      const allClosed    = roundMatches.every(b => b.status === 'closed' || b.winner_id !== null || b.id === openMatch.id)

      if (allClosed) {
        const nextRound = allBrackets.filter(b => b.round_number === currentRound + 1)
        if (nextRound.length === 0) {
          // Tournament over
          sfx.winner()
          await updateLobbyStatus(lobby.id, 'finished')
          await emitLobbyEvent(lobby.id, 'tournament_finished', { winner_id: winnerId })
        } else {
          // Advance to next round
          const scores = powerScores.length > 0
            ? powerScores
            : await getPowerScores(players.map(p => p.id))
          const weaponList = weapons.length > 0
            ? weapons
            : await getWeaponsForLobby(lobby.weapon_set_id)

          if (is2v2) {
            await advanceWinners2v2(lobby.id, currentRound, scores, weaponList)
          } else {
            await advanceWinners(lobby.id, currentRound, scores, weaponList)
          }
          await updateLobbyStatus(lobby.id, 'between_rounds', currentRound + 1)
          await emitLobbyEvent(lobby.id, 'round_complete', { next_round: currentRound + 1 })
        }
      } else {
        // More matches in this round: auto-open next pending match
        const nextMatch = allBrackets.find(b =>
          b.round_number === currentRound &&
          b.status === 'pending' &&
          b.player1_id && b.player2_id
        )
        if (nextMatch) {
          await openBracketMatch(nextMatch.id)
          setActiveMatchId(nextMatch.id)
          await emitLobbyEvent(lobby.id, 'match_opened', { match_id: nextMatch.id })
        } else {
          // Fallback: no pending match found. Run advanceWinners to populate the
          // next round player IDs before transitioning, so the host is not stuck.
          const scores = powerScores.length > 0
            ? powerScores
            : await getPowerScores(players.map(p => p.id))
          const weaponList = weapons.length > 0
            ? weapons
            : await getWeaponsForLobby(lobby.weapon_set_id)
          if (is2v2) {
            await advanceWinners2v2(lobby.id, currentRound, scores, weaponList)
          } else {
            await advanceWinners(lobby.id, currentRound, scores, weaponList)
          }
          await updateLobbyStatus(lobby.id, 'between_rounds', currentRound + 1)
          await emitLobbyEvent(lobby.id, 'round_complete', { next_round: currentRound + 1 })
        }
      }
    } finally {
      setClosing(false)
    }
  }

  if (!openMatch) {
    return (
      <div className={styles.page}>
        <ArcadeFrame title={t('match.waitingTitle')}>
          <p className="text-ui text-dim text-center">{t('match.waitingMsg')}</p>
        </ArcadeFrame>
      </div>
    )
  }

  const votingOpen    = votingStarted && countdown !== null && countdown > 0
  const votingDisabled = !votingOpen || !!myVote || !me

  return (
    <div className={styles.page}>
      {showFight && (
        <div className={styles.fightBanner}>
          <span className={styles.fightText}>{t('match.fight')}</span>
        </div>
      )}

      <div className={styles.vsContainer}>
        {/* Team A / Fighter 1 side */}
        <div className={[styles.fighter, styles.fighter1].join(' ')}>
          {is2v2 && <h3 className={styles.teamLabel}>{t('match.teamA')}</h3>}
          {p1 && <PlayerAvatar player={p1} size="xl" highlight="blue" />}
          <h2 className={styles.fighterName}>{p1?.name ?? 'TBD'}</h2>
          {w1 && <WeaponBadge weapon={w1} />}
          {p1Score && <StatBars score={p1Score} side="left" />}
          {/* 2v2: second team member */}
          {is2v2 && p3 && (
            <div className={styles.teamMate}>
              <PlayerAvatar player={p3} size="lg" highlight="blue" />
              <span className={styles.fighterName}>{p3.name}</span>
              {w3 && <WeaponBadge weapon={w3} />}
              {p3Score && <StatBars score={p3Score} side="left" />}
            </div>
          )}
          <button
            className={[styles.voteBtn, myVote?.voted_for_id === p1?.id ? styles.voted : ''].join(' ')}
            disabled={votingDisabled}
            onClick={() => p1 && handleVote(p1.id)}
          >
            {is2v2 ? t('match.voteTeamA', { n: p1Votes }) : t('match.vote', { n: p1Votes })}
          </button>
        </div>

        {/* VS divider */}
        <div className={styles.vsDivider}>
          <span className={styles.vsLabel}>{t('match.vs')}</span>

          {/* Countdown or waiting message */}
          {!winner && !winnerTeam && countdown !== null && (
            <span
              key={countdown}
              className={[
                styles.countdown,
                countdown <= 3 ? styles.countdownUrgent : '',
              ].join(' ')}
            >
              {countdown === 0 ? t('match.timeUp') : countdown}
            </span>
          )}
          {!winner && !winnerTeam && !votingStarted && (
            <span className={styles.waitingVoting}>
              {t('match.waitingVoting')}
            </span>
          )}

          <div className={styles.voteBar}>
            <div className={styles.barP1} style={{ width: `${(p1Votes / totalVotes) * 100}%` }} />
            <div className={styles.barP2} style={{ width: `${(p2Votes / totalVotes) * 100}%` }} />
          </div>
          <span className={styles.voteCount}>{t('match.votes', { n: matchVotes.length })}</span>
          {myVote && <span className="text-green text-ui">{t('match.voted')}</span>}
        </div>

        {/* Team B / Fighter 2 side */}
        <div className={[styles.fighter, styles.fighter2].join(' ')}>
          {is2v2 && <h3 className={styles.teamLabel}>{t('match.teamB')}</h3>}
          {p2 && <PlayerAvatar player={p2} size="xl" highlight="red" />}
          <h2 className={styles.fighterName}>{p2?.name ?? 'TBD'}</h2>
          {w2 && <WeaponBadge weapon={w2} />}
          {p2Score && <StatBars score={p2Score} side="right" />}
          {/* 2v2: second team member */}
          {is2v2 && p4 && (
            <div className={styles.teamMate}>
              <PlayerAvatar player={p4} size="lg" highlight="red" />
              <span className={styles.fighterName}>{p4.name}</span>
              {w4 && <WeaponBadge weapon={w4} />}
              {p4Score && <StatBars score={p4Score} side="right" />}
            </div>
          )}
          <button
            className={[styles.voteBtn, styles.voteBtnRed, myVote?.voted_for_id === p2?.id ? styles.voted : ''].join(' ')}
            disabled={votingDisabled}
            onClick={() => p2 && handleVote(p2.id)}
          >
            {is2v2 ? t('match.voteTeamB', { n: p2Votes }) : t('match.vote', { n: p2Votes })}
          </button>
        </div>
      </div>

      {winner && !is2v2 && (
        <div className={styles.winnerBanner}>
          <span className={styles.winnerText}>{t('match.winner', { name: winner.name })}</span>
        </div>
      )}
      {winnerTeam && is2v2 && (
        <div className={styles.winnerBanner}>
          <span className={styles.winnerText}>{t('match.teamWinner', { team: winnerTeam })}</span>
        </div>
      )}

      {isHost && !winner && (
        <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', justifyContent: 'center' }}>
          {!votingStarted && (
            <ArcadeButton variant="green" size="lg" onClick={handleStartVoting}>
              {t('match.startVoting')}
            </ArcadeButton>
          )}
          {votingStarted && (
            <ArcadeButton variant="red" size="lg" loading={closing} onClick={handleCloseMatch}>
              {t('match.closeMatch')}
            </ArcadeButton>
          )}
        </div>
      )}
    </div>
  )
}
