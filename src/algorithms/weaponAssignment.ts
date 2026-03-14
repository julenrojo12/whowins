import type { Weapon, BracketMatch, PlayerPowerScore } from '../types/game'
import type { TeamComposition } from './teamFormation'

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
 * 2v2 weapon assignment: inverse balance at team level, then intra-team balance.
 *
 * For each match (team A = player1+player3, team B = player2+player4):
 *   1. Compute team power scores (average of 2 members).
 *   2. Stronger team → both weapons from the LOW-danger pool.
 *   3. Weaker team   → both weapons from the HIGH-danger pool.
 *   4. Within each team: stronger member gets the safer weapon.
 */
export function assignWeaponsToMatches2v2(
  matches: BracketMatch[],
  scores: PlayerPowerScore[],
  weapons: Weapon[],
  _teams: TeamComposition[]   // kept for future use / traceability
): { matchId: string; weapon1_id: string; weapon2_id: string; weapon3_id: string; weapon4_id: string }[] {
  const scoreMap = new Map(scores.map(s => [s.player_id, s.power_score]))
  const sorted = [...weapons].sort((a, b) => a.danger_level - b.danger_level)
  const n = sorted.length
  const result: { matchId: string; weapon1_id: string; weapon2_id: string; weapon3_id: string; weapon4_id: string }[] = []

  for (const match of matches) {
    if (!match.player1_id || !match.player2_id || !match.player3_id || !match.player4_id) continue

    const p1Score = scoreMap.get(match.player1_id) ?? 50
    const p2Score = scoreMap.get(match.player2_id) ?? 50
    const p3Score = scoreMap.get(match.player3_id) ?? 50
    const p4Score = scoreMap.get(match.player4_id) ?? 50

    const teamAScore = (p1Score + p3Score) / 2
    const teamBScore = (p2Score + p4Score) / 2

    const gap = Math.abs(teamAScore - teamBScore) / 100
    const curvedGap = Math.pow(gap, 1.5)

    const mid    = Math.floor(n / 2)
    const offset = Math.round(curvedGap * mid)

    // Low-danger pool for the stronger team; high-danger pool for the weaker team
    const strongerPoolEnd  = Math.max(2, mid - offset)
    const weakerPoolStart  = Math.min(n - 2, mid + offset)

    const lowPool  = sorted.slice(0, strongerPoolEnd)
    const highPool = sorted.slice(weakerPoolStart)

    // Assign 2 distinct weapons from each pool
    const [lowW1, lowW2]   = pickTwoDistinct(lowPool,  sorted[0])
    const [highW1, highW2] = pickTwoDistinctWeighted(highPool, sorted[n - 1])

    // Within each team: stronger member gets the safer weapon
    const teamAStronger = p1Score >= p3Score
    const weapon1 = teamAStronger ? lowW1  : lowW2
    const weapon3 = teamAStronger ? lowW2  : lowW1

    const teamBStronger = p2Score >= p4Score
    const weapon2 = teamBStronger ? highW1 : highW2
    const weapon4 = teamBStronger ? highW2 : highW1

    // Swap if team B is actually stronger
    if (teamBScore > teamAScore) {
      result.push({
        matchId:    match.id,
        weapon1_id: weapon2.id,
        weapon2_id: weapon1.id,
        weapon3_id: weapon4.id,
        weapon4_id: weapon3.id,
      })
    } else {
      result.push({
        matchId:    match.id,
        weapon1_id: weapon1.id,
        weapon2_id: weapon2.id,
        weapon3_id: weapon3.id,
        weapon4_id: weapon4.id,
      })
    }
  }

  return result
}

/** Pick two distinct weapons from pool; falls back to fallback for the second if needed. */
function pickTwoDistinct(pool: Weapon[], fallback: Weapon): [Weapon, Weapon] {
  if (pool.length === 0) return [fallback, fallback]
  const first = pool[Math.floor(Math.random() * pool.length)]
  const rest  = pool.filter(w => w.id !== first.id)
  const second = rest.length > 0
    ? rest[Math.floor(Math.random() * rest.length)]
    : fallback
  return [first, second]
}

/** Pick two distinct weapons with inverse-danger weighting. */
function pickTwoDistinctWeighted(pool: Weapon[], fallback: Weapon): [Weapon, Weapon] {
  if (pool.length === 0) return [fallback, fallback]
  const first = weightedDangerPick(pool, fallback)
  const rest  = pool.filter(w => w.id !== first.id)
  const second = weightedDangerPick(rest, first.id !== fallback.id ? fallback : pool[0])
  return [first, second]
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
