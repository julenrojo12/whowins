import { useEffect, useState } from 'react'
import styles from './Match.module.css'
import { ArcadeButton } from '../../components/ui/ArcadeButton'
import { ArcadeFrame } from '../../components/layout/ArcadeFrame'
import { PlayerAvatar } from '../../components/game/PlayerAvatar'
import { WeaponBadge } from '../../components/game/WeaponBadge'
import { castVote, getVotesForBracket, determineWinner } from '../../services/voteService'
import { closeMatch, getBrackets, advanceWinners, openMatch as openBracketMatch } from '../../services/bracketService'
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
import { useT } from '../../i18n'
import type { BracketMatch, Player } from '../../types/game'

export function MatchPage() {
  const sessionId = useSession()
  const isHost    = useIsHost()
  const { lobby, players, setPlayers, brackets, setBrackets, votes, upsertVote,
          setActiveMatchId, powerScores, weapons, setWeapons } = useGameStore()
  useLobbyRealtime(lobby?.id ?? null)
  useLobbyMusic('battle')
  const t = useT()

  const [showFight, setShowFight] = useState(false)
  const [closing, setClosing]     = useState(false)
  const [winner, setWinner]       = useState<Player | null>(null)

  // On mount: ensure players, weapons, and brackets are loaded
  useEffect(() => {
    if (!lobby) return
    getPlayersForLobby(lobby.id).then(setPlayers)
    if (lobby.weapon_set_id) getWeaponsForLobby(lobby.weapon_set_id).then(setWeapons)
    getBrackets(lobby.id).then(setBrackets)
  }, [lobby?.id])

  // Find the open match
  const openMatch: BracketMatch | undefined = brackets.find(b => b.status === 'open')

  useEffect(() => {
    if (!openMatch) return
    setActiveMatchId(openMatch.id)
    setShowFight(false)
    setWinner(null)
    sfx.vsSlam()
    setTimeout(() => setShowFight(true), 1000)
  }, [openMatch?.id])

  useEffect(() => {
    if (!openMatch) return
    getVotesForBracket(openMatch.id).then(vs => vs.forEach(upsertVote))
  }, [openMatch?.id])

  const me = players.find(p => p.session_id === sessionId)
  const p1 = players.find(p => p.id === openMatch?.player1_id)
  const p2 = players.find(p => p.id === openMatch?.player2_id)
  const w1 = weapons.find(w => w.id === openMatch?.weapon1_id)
  const w2 = weapons.find(w => w.id === openMatch?.weapon2_id)

  const matchVotes  = votes.filter(v => v.bracket_id === openMatch?.id)
  const myVote      = matchVotes.find(v => v.voter_id === me?.id)
  const p1Votes     = matchVotes.filter(v => v.voted_for_id === openMatch?.player1_id).length
  const p2Votes     = matchVotes.filter(v => v.voted_for_id === openMatch?.player2_id).length
  const totalVotes  = matchVotes.length || 1

  async function handleVote(playerId: string) {
    if (!openMatch || !me || myVote) return
    const vote = await castVote(openMatch.id, me.id, playerId)
    upsertVote(vote)
    sfx.voteCast()
  }

  async function handleCloseMatch() {
    if (!openMatch || !lobby || !isHost) return
    setClosing(true)
    sfx.matchClose()
    try {
      const freshVotes = await getVotesForBracket(openMatch.id)
      const winnerId   = openMatch.player1_id && openMatch.player2_id
        ? determineWinner(freshVotes, openMatch.player1_id, openMatch.player2_id)
        : openMatch.player1_id ?? ''

      const loserId = winnerId === openMatch.player1_id ? openMatch.player2_id : openMatch.player1_id

      await closeMatch(openMatch.id, winnerId)
      if (loserId) await eliminatePlayer(loserId)
      sfx.knockout()

      const winnerPlayer = players.find(p => p.id === winnerId) ?? null
      setWinner(winnerPlayer)

      // Check if round is complete
      const allBrackets = await getBrackets(lobby.id)
      const currentRound = openMatch.round_number
      const roundMatches = allBrackets.filter(b => b.round_number === currentRound)
      const allClosed    = roundMatches.every(b => b.status === 'closed' || b.id === openMatch.id)

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
            : (lobby.weapon_set_id ? await getWeaponsForLobby(lobby.weapon_set_id) : [])

          await advanceWinners(lobby.id, currentRound, scores, weaponList)
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
          await updateLobbyStatus(lobby.id, 'between_rounds')
          await emitLobbyEvent(lobby.id, 'match_closed', { match_id: openMatch.id })
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

  return (
    <div className={styles.page}>
      {showFight && (
        <div className={styles.fightBanner}>
          <span className={styles.fightText}>{t('match.fight')}</span>
        </div>
      )}

      <div className={styles.vsContainer}>
        {/* Fighter 1 */}
        <div className={[styles.fighter, styles.fighter1].join(' ')}>
          {p1 && <PlayerAvatar player={p1} size="xl" highlight="blue" />}
          <h2 className={styles.fighterName}>{p1?.name ?? 'TBD'}</h2>
          {w1 && <WeaponBadge weapon={w1} />}
          <button
            className={[styles.voteBtn, myVote?.voted_for_id === p1?.id ? styles.voted : ''].join(' ')}
            disabled={!!myVote || !me}
            onClick={() => p1 && handleVote(p1.id)}
          >
            {t('match.vote', { n: p1Votes })}
          </button>
        </div>

        {/* VS divider */}
        <div className={styles.vsDivider}>
          <span className={styles.vsLabel}>{t('match.vs')}</span>
          <div className={styles.voteBar}>
            <div className={styles.barP1} style={{ width: `${(p1Votes / totalVotes) * 100}%` }} />
            <div className={styles.barP2} style={{ width: `${(p2Votes / totalVotes) * 100}%` }} />
          </div>
          <span className={styles.voteCount}>{t('match.votes', { n: matchVotes.length })}</span>
          {myVote && <span className="text-green text-ui">{t('match.voted')}</span>}
        </div>

        {/* Fighter 2 */}
        <div className={[styles.fighter, styles.fighter2].join(' ')}>
          {p2 && <PlayerAvatar player={p2} size="xl" highlight="red" />}
          <h2 className={styles.fighterName}>{p2?.name ?? 'TBD'}</h2>
          {w2 && <WeaponBadge weapon={w2} />}
          <button
            className={[styles.voteBtn, styles.voteBtnRed, myVote?.voted_for_id === p2?.id ? styles.voted : ''].join(' ')}
            disabled={!!myVote || !me}
            onClick={() => p2 && handleVote(p2.id)}
          >
            {t('match.vote', { n: p2Votes })}
          </button>
        </div>
      </div>

      {winner && (
        <div className={styles.winnerBanner}>
          <span className={styles.winnerText}>{t('match.winner', { name: winner.name })}</span>
        </div>
      )}

      {isHost && !winner && (
        <ArcadeButton variant="red" size="lg" loading={closing} onClick={handleCloseMatch}>
          {t('match.closeMatch')}
        </ArcadeButton>
      )}
    </div>
  )
}
