import type { PlayerPowerScore, BracketMatch } from '../types/game'

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
