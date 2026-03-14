import type { PlayerPowerScore } from '../types/game'

export interface TeamComposition {
  teamSlot: number
  player_a_id: string   // stronger member (higher power score)
  player_b_id: string   // weaker member (lower power score)
  combined_score: number
}

/**
 * Snake-draft team formation for balanced 2v2.
 * Players sorted DESC by power score are paired:
 *   Team 1: rank[0]   + rank[N-1]   (strongest + weakest)
 *   Team 2: rank[1]   + rank[N-2]
 *   ...
 * This produces teams with similar combined power scores.
 */
export function formBalancedTeams(scores: PlayerPowerScore[]): TeamComposition[] {
  const sorted = [...scores].sort((a, b) => b.power_score - a.power_score)
  const n = sorted.length
  const teams: TeamComposition[] = []

  for (let i = 0; i < Math.floor(n / 2); i++) {
    const stronger = sorted[i]
    const weaker   = sorted[n - 1 - i]
    teams.push({
      teamSlot:       i + 1,
      player_a_id:    stronger.player_id,
      player_b_id:    weaker.player_id,
      combined_score: (stronger.power_score + weaker.power_score) / 2,
    })
  }

  return teams
}
