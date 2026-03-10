import type { Weapon, BracketMatch, PlayerPowerScore } from '../types/game'
import { shuffle } from '../lib/utils'

/**
 * Inverse balance: stronger player gets lower danger weapon, weaker gets higher danger.
 * dangerBudget = floor(gap × weaponCount)
 */
export function assignWeaponsToMatches(
  matches: BracketMatch[],
  scores: PlayerPowerScore[],
  weapons: Weapon[]
): { matchId: string; weapon1_id: string; weapon2_id: string }[] {
  const scoreMap = new Map(scores.map(s => [s.player_id, s.power_score]))
  const sorted = [...weapons].sort((a, b) => a.danger_level - b.danger_level)
  const n = sorted.length
  const result: { matchId: string; weapon1_id: string; weapon2_id: string }[] = []

  for (const match of matches) {
    if (!match.player1_id || !match.player2_id) continue

    const p1Score = scoreMap.get(match.player1_id) ?? 50
    const p2Score = scoreMap.get(match.player2_id) ?? 50

    const gap = Math.abs(p1Score - p2Score) / 100
    const budget = Math.max(1, Math.floor(gap * n))

    // Shuffle the buckets for randomness
    const lowDanger  = shuffle(sorted.slice(0, budget))
    const highDanger = shuffle(sorted.slice(Math.max(0, n - budget)))

    const strongerWeapon = lowDanger[0]  || sorted[0]
    const weakerWeapon   = highDanger[0] || sorted[n - 1]

    const p1Stronger = p1Score >= p2Score

    result.push({
      matchId:    match.id,
      weapon1_id: p1Stronger ? strongerWeapon.id : weakerWeapon.id,
      weapon2_id: p1Stronger ? weakerWeapon.id   : strongerWeapon.id,
    })
  }

  return result
}
