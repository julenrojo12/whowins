import type { PlayerPowerScore, BracketMatch } from '../types/game'
import type { TeamComposition } from './teamFormation'

interface SeededPlayer {
  player_id: string
  power_score: number
  avg_strength: number
  avg_skill: number
  avg_resistance: number
  bracket_seed: number
}

/**
 * Snake seeding:
 * Match 1: seed[0] vs seed[N-1]   (strongest vs weakest)
 * Match 2: seed[1] vs seed[N-2]
 * ...
 */
export function generateFirstRoundMatches(
  lobbyId: string,
  scores: PlayerPowerScore[]
): Omit<BracketMatch, 'id' | 'created_at'>[] {
  const sorted = [...scores].sort((a, b) => b.power_score - a.power_score)
  const n = sorted.length
  const matches: Omit<BracketMatch, 'id' | 'created_at'>[] = []

  for (let i = 0; i < n / 2; i++) {
    matches.push({
      lobby_id:     lobbyId,
      round_number: 1,
      match_number: i + 1,
      player1_id:   sorted[i].player_id,
      player2_id:   sorted[n - 1 - i].player_id,
      weapon1_id:   null,
      weapon2_id:   null,
      status:       'pending',
      winner_id:    null,
    })
  }

  return matches
}

/**
 * Generate empty bracket shells for subsequent rounds.
 * Players filled in via advanceWinners() after each round.
 */
export function generateEmptyRounds(
  lobbyId: string,
  totalPlayers: number
): Omit<BracketMatch, 'id' | 'created_at'>[] {
  const shells: Omit<BracketMatch, 'id' | 'created_at'>[] = []
  let matchesInRound = totalPlayers / 2
  let round = 2

  while (matchesInRound >= 1) {
    matchesInRound /= 2
    if (matchesInRound < 1) break
    for (let m = 1; m <= matchesInRound; m++) {
      shells.push({
        lobby_id:     lobbyId,
        round_number: round,
        match_number: m,
        player1_id:   null,
        player2_id:   null,
        weapon1_id:   null,
        weapon2_id:   null,
        status:       'pending',
        winner_id:    null,
      })
    }
    round++
  }

  return shells
}

/**
 * Given winners from round N, fill in round N+1 match player slots.
 * Winners from match 1 → slot 1 of next round match, match 2 → slot 2, etc.
 */
export function getNextRoundUpdates(
  completedRoundMatches: BracketMatch[],
  nextRoundMatches: BracketMatch[]
): { matchId: string; player1_id?: string; player2_id?: string }[] {
  const sorted = [...completedRoundMatches].sort((a, b) => a.match_number - b.match_number)
  const updates: { matchId: string; player1_id?: string; player2_id?: string }[] = []

  sorted.forEach((match, idx) => {
    const targetMatchIndex = Math.floor(idx / 2)
    const targetMatch = nextRoundMatches[targetMatchIndex]
    if (!targetMatch || !match.winner_id) return

    if (idx % 2 === 0) {
      updates.push({ matchId: targetMatch.id, player1_id: match.winner_id })
    } else {
      updates.push({ matchId: targetMatch.id, player2_id: match.winner_id })
    }
  })

  return updates
}

export function assignSeeds(scores: Omit<PlayerPowerScore, 'bracket_seed'>[]): SeededPlayer[] {
  return scores
    .sort((a, b) => b.power_score - a.power_score)
    .map((s, i) => ({ ...s, bracket_seed: i + 1 }))
}

// ─── 2v2 bracket generation ─────────────────────────────────────────────────

/**
 * Generate round 1 matches for 2v2 mode.
 * Teams are snake-seeded by combined_score DESC.
 *   Match 1: team[0] vs team[T-1]   (strongest vs weakest team)
 *   Match 2: team[1] vs team[T-2]
 *   ...
 * player1/player3 = team A members (a and b)
 * player2/player4 = team B members (a and b)
 */
export function generateFirstRoundMatches2v2(
  lobbyId: string,
  teams: TeamComposition[]
): Omit<BracketMatch, 'id' | 'created_at'>[] {
  const sorted = [...teams].sort((a, b) => b.combined_score - a.combined_score)
  const t = sorted.length
  const matches: Omit<BracketMatch, 'id' | 'created_at'>[] = []

  for (let i = 0; i < Math.floor(t / 2); i++) {
    const teamA = sorted[i]
    const teamB = sorted[t - 1 - i]
    matches.push({
      lobby_id:     lobbyId,
      round_number: 1,
      match_number: i + 1,
      player1_id:   teamA.player_a_id,
      player2_id:   teamB.player_a_id,
      player3_id:   teamA.player_b_id,
      player4_id:   teamB.player_b_id,
      weapon1_id:   null,
      weapon2_id:   null,
      weapon3_id:   null,
      weapon4_id:   null,
      status:       'pending',
      winner_id:    null,
    })
  }

  return matches
}

/**
 * Generate empty bracket shells for subsequent rounds in 2v2.
 * totalTeams is the number of teams (= format / 2).
 */
export function generateEmptyRounds2v2(
  lobbyId: string,
  totalTeams: number
): Omit<BracketMatch, 'id' | 'created_at'>[] {
  const shells: Omit<BracketMatch, 'id' | 'created_at'>[] = []
  let matchesInRound = totalTeams / 2
  let round = 2

  while (matchesInRound >= 1) {
    matchesInRound /= 2
    if (matchesInRound < 1) break
    for (let m = 1; m <= matchesInRound; m++) {
      shells.push({
        lobby_id:     lobbyId,
        round_number: round,
        match_number: m,
        player1_id:   null,
        player2_id:   null,
        player3_id:   null,
        player4_id:   null,
        weapon1_id:   null,
        weapon2_id:   null,
        weapon3_id:   null,
        weapon4_id:   null,
        status:       'pending',
        winner_id:    null,
      })
    }
    round++
  }

  return shells
}

/**
 * Advance 2v2 winners to the next round.
 * For each closed match, determine the winning pair:
 *   winner_id === player1_id → winning pair = [player1_id, player3_id]
 *   winner_id === player2_id → winning pair = [player2_id, player4_id]
 * Returns updates to fill player1+player3 (even index) or player2+player4 (odd index)
 * in the next round matches.
 */
export function getNextRoundUpdates2v2(
  completedRoundMatches: BracketMatch[],
  nextRoundMatches: BracketMatch[]
): { matchId: string; player1_id?: string; player2_id?: string; player3_id?: string; player4_id?: string }[] {
  const sorted  = [...completedRoundMatches].sort((a, b) => a.match_number - b.match_number)
  const updates: { matchId: string; player1_id?: string; player2_id?: string; player3_id?: string; player4_id?: string }[] = []

  sorted.forEach((match, idx) => {
    const targetMatchIndex = Math.floor(idx / 2)
    const targetMatch = nextRoundMatches[targetMatchIndex]
    if (!targetMatch || !match.winner_id) return

    // Determine winning pair
    const winnerIsP1 = match.winner_id === match.player1_id
    const winnerA = winnerIsP1 ? match.player1_id : match.player2_id
    const winnerB = winnerIsP1 ? match.player3_id  : match.player4_id

    if (!winnerA || !winnerB) return

    if (idx % 2 === 0) {
      updates.push({ matchId: targetMatch.id, player1_id: winnerA, player3_id: winnerB })
    } else {
      updates.push({ matchId: targetMatch.id, player2_id: winnerA, player4_id: winnerB })
    }
  })

  return updates
}
