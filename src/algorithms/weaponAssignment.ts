import type { Weapon, BracketMatch, PlayerPowerScore } from '../types/game'

/**
 * Inverse balance: stronger player gets lower danger weapon, weaker gets higher danger.
 *
 * Two mechanisms reduce the probability of max-danger (5-star) weapons:
 *
 * 1. Curved gap: the pool offset uses gap^1.5 instead of gap, so only extreme
 *    power differences push toward the most dangerous weapons.
 *
 * 2. Inverse-danger weighted pick: within the weaker player's pool, weapons are
 *    chosen with probability ∝ 1/danger_level², so higher-danger weapons are
 *    progressively less likely to be selected.
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

    // Apply a curve so only large gaps push toward the danger extremes.
    // gap^1.5 examples: 0.3→0.16, 0.5→0.35, 0.8→0.72, 1.0→1.0
    const curvedGap = Math.pow(gap, 1.5)

    const mid = Math.floor(n / 2)
    const offset = Math.round(curvedGap * mid)

    // Stronger player: pool from the safest weapons (index 0 → mid-offset)
    // Weaker player:   pool from the more dangerous weapons (mid+offset → n-1)
    const strongerPoolEnd = Math.max(1, mid - offset)
    const weakerPoolStart = Math.min(n - 1, mid + offset)

    const strongerPool = sorted.slice(0, strongerPoolEnd)
    const weakerPool   = sorted.slice(weakerPoolStart)

    const strongerWeapon = strongerPool[Math.floor(Math.random() * strongerPool.length)] ?? sorted[0]

    // Weighted pick for the weaker player: probability ∝ 1/danger_level²
    // This makes 5-star weapons significantly less likely than 3-star ones.
    const weakerWeapon = weightedDangerPick(
      weakerPool.filter(w => w.id !== strongerWeapon.id),
      sorted[n - 1]
    )

    const p1Stronger = p1Score >= p2Score

    result.push({
      matchId:    match.id,
      weapon1_id: p1Stronger ? strongerWeapon.id : weakerWeapon.id,
      weapon2_id: p1Stronger ? weakerWeapon.id   : strongerWeapon.id,
    })
  }

  return result
}

/**
 * Picks a weapon from the pool with probability inversely proportional to danger_level².
 * A weapon at danger 2 is 4× more likely to be picked than one at danger 4,
 * and 25× more likely than one at danger 10.
 * Falls back to `fallback` if the pool is empty.
 */
function weightedDangerPick(pool: Weapon[], fallback: Weapon): Weapon {
  if (pool.length === 0) return fallback

  const weights = pool.map(w => 1 / (w.danger_level * w.danger_level))
  const total = weights.reduce((a, b) => a + b, 0)

  let rand = Math.random() * total
  for (let i = 0; i < pool.length; i++) {
    rand -= weights[i]
    if (rand <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}
