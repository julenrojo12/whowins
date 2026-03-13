import type { Rating, PlayerPowerScore } from '../types/game'

/**
 * powerScore = ((strength×0.50 + skill×0.30 + resistance×0.20) − 1) / 4 × 100
 * Result: 0–100
 */
export function calcPowerScore(strength: number, skill: number, resistance: number): number {
  const weighted = strength * 0.50 + skill * 0.30 + resistance * 0.20
  return ((weighted - 1) / 4) * 100
}

/** Given all ratings for all players in a lobby, compute power scores for each player */
export function computeAllPowerScores(
  playerIds: string[],
  ratings: Rating[]
): Omit<PlayerPowerScore, 'bracket_seed'>[] {
  return playerIds.map(playerId => {
    const received = ratings.filter(r => r.target_id === playerId)

    const count = received.length
    const avg_strength   = count > 0 ? received.reduce((s, r) => s + r.strength,   0) / count : 3
    const avg_skill      = count > 0 ? received.reduce((s, r) => s + r.skill,      0) / count : 3
    const avg_resistance = count > 0 ? received.reduce((s, r) => s + r.resistance, 0) / count : 3

    return {
      player_id: playerId,
      avg_strength,
      avg_skill,
      avg_resistance,
      power_score: calcPowerScore(avg_strength, avg_skill, avg_resistance),
    }
  })
}
