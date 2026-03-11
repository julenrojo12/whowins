import type { Weapon, BracketMatch, PlayerPowerScore } from '../types/game'
import { shuffle } from '../lib/utils'

/**
 * Inverse balance: stronger player gets lower danger weapon, weaker gets higher danger.
 *
 * Logic: sort weapons by danger ASC and split at the midpoint.
 *   - gap=0 (equal scores)  → stronger draws from lower half, weaker from upper half
 *   - gap=1 (max difference) → stronger gets the safest weapon, weaker gets the most dangerous
 *
 * The gap pushes each pool toward the extremes proportionally, so evenly-matched
 * fighters get weapons of similar danger and mismatched fighters get opposite extremes.
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

    const gap = Math.abs(p1Score - p2Score) / 100  // 0..1
    const mid = Math.floor(n / 2)
    const offset = Math.round(gap * mid)

    // Stronger player: pool from the safest weapons (index 0 → mid-offset)
    // Weaker player:   pool from the most dangerous weapons (mid+offset → n-1)
    const strongerPoolEnd = Math.max(1, mid - offset)
    const weakerPoolStart = Math.min(n - 1, mid + offset)

    const strongerPool = shuffle(sorted.slice(0, strongerPoolEnd))
    const weakerPool   = shuffle(sorted.slice(weakerPoolStart))

    const strongerWeapon = strongerPool[0] ?? sorted[0]
    // Avoid assigning the same weapon to both fighters
    const weakerWeapon   = weakerPool.find(w => w.id !== strongerWeapon.id) ?? sorted[n - 1]

    const p1Stronger = p1Score >= p2Score

    result.push({
      matchId:    match.id,
      weapon1_id: p1Stronger ? strongerWeapon.id : weakerWeapon.id,
      weapon2_id: p1Stronger ? weakerWeapon.id   : strongerWeapon.id,
    })
  }

  return result
}
