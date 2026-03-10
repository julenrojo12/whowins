import { supabase } from '../lib/supabase'
import type { BracketMatch, PlayerPowerScore, Weapon } from '../types/game'
import { computeAllPowerScores } from '../algorithms/powerScore'
import { generateFirstRoundMatches, generateEmptyRounds, getNextRoundUpdates, assignSeeds } from '../algorithms/bracket'
import { assignWeaponsToMatches } from '../algorithms/weaponAssignment'
import { getRatingsForLobby } from './ratingService'

export async function savePowerScores(
  playerIds: string[],
  lobbyId: string
): Promise<PlayerPowerScore[]> {
  const ratings = await getRatingsForLobby(lobbyId)
  const rawScores = computeAllPowerScores(playerIds, ratings)
  const seeded    = assignSeeds(rawScores)

  const rows = seeded.map(s => ({
    player_id:      s.player_id,
    avg_strength:   s.avg_strength,
    avg_skill:      s.avg_skill,
    avg_resistance: s.avg_resistance,
    power_score:    s.power_score,
    bracket_seed:   s.bracket_seed,
  }))

  const { error } = await supabase
    .from('player_power_scores')
    .upsert(rows, { onConflict: 'player_id' })

  if (error) throw error
  return rows
}

export async function getPowerScores(playerIds: string[]): Promise<PlayerPowerScore[]> {
  const { data, error } = await supabase
    .from('player_power_scores')
    .select()
    .in('player_id', playerIds)

  if (error) throw error
  return (data as PlayerPowerScore[]) ?? []
}

export async function generateBracket(
  lobbyId: string,
  scores: PlayerPowerScore[],
  weapons: Weapon[]
): Promise<BracketMatch[]> {
  const round1 = generateFirstRoundMatches(lobbyId, scores)
  const later  = generateEmptyRounds(lobbyId, scores.length)

  const { data, error } = await supabase
    .from('brackets')
    .insert([...round1, ...later])
    .select()

  if (error) throw error
  const allMatches = data as BracketMatch[]

  // Assign weapons to round 1
  const round1Saved = allMatches.filter(m => m.round_number === 1)
  await applyWeaponAssignments(round1Saved, scores, weapons)

  return allMatches
}

export async function applyWeaponAssignments(
  matches: BracketMatch[],
  scores: PlayerPowerScore[],
  weapons: Weapon[]
): Promise<void> {
  const assignments = assignWeaponsToMatches(matches, scores, weapons)
  for (const a of assignments) {
    const { error } = await supabase
      .from('brackets')
      .update({ weapon1_id: a.weapon1_id, weapon2_id: a.weapon2_id })
      .eq('id', a.matchId)
    if (error) throw error
  }
}

export async function getBrackets(lobbyId: string): Promise<BracketMatch[]> {
  const { data, error } = await supabase
    .from('brackets')
    .select()
    .eq('lobby_id', lobbyId)
    .order('round_number')
    .order('match_number')

  if (error) throw error
  return (data as BracketMatch[]) ?? []
}

export async function openMatch(matchId: string): Promise<void> {
  const { error } = await supabase
    .from('brackets')
    .update({ status: 'open' })
    .eq('id', matchId)
  if (error) throw error
}

export async function closeMatch(matchId: string, winnerId: string): Promise<void> {
  const { error } = await supabase
    .from('brackets')
    .update({ status: 'closed', winner_id: winnerId })
    .eq('id', matchId)
  if (error) throw error
}

export async function advanceWinners(
  lobbyId: string,
  completedRound: number,
  scores: PlayerPowerScore[],
  weapons: Weapon[]
): Promise<void> {
  const allBrackets = await getBrackets(lobbyId)
  const completedMatches = allBrackets.filter(m => m.round_number === completedRound)
  const nextMatches      = allBrackets.filter(m => m.round_number === completedRound + 1)

  const updates = getNextRoundUpdates(completedMatches, nextMatches)
  for (const u of updates) {
    const upd: Record<string, string | undefined> = {}
    if (u.player1_id) upd.player1_id = u.player1_id
    if (u.player2_id) upd.player2_id = u.player2_id
    const { error } = await supabase.from('brackets').update(upd).eq('id', u.matchId)
    if (error) throw error
  }

  // Re-assign weapons for next round matches
  const updatedNext = await getBrackets(lobbyId).then(b => b.filter(m => m.round_number === completedRound + 1))
  await applyWeaponAssignments(updatedNext, scores, weapons)
}
