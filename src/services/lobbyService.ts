import { supabase } from '../lib/supabase'
import { generateLobbyCode } from '../lib/utils'
import type { Lobby } from '../types/game'
import { savePowerScores, generateBracket, openMatch } from './bracketService'
import { getWeaponsForLobby } from './setsService'

export async function createLobby(
  hostSessionId: string,
  format: number,
  characterSetId: string,
  weaponSetId: string
): Promise<Lobby> {
  const code = generateLobbyCode()
  const { data, error } = await supabase
    .from('lobbies')
    .insert({
      code,
      host_session_id: hostSessionId,
      format,
      character_set_id: characterSetId,
      weapon_set_id: weaponSetId,
      status: 'waiting',
      current_round: 0,
    })
    .select()
    .single()

  if (error) throw error
  return data as Lobby
}

export async function getLobbyByCode(code: string): Promise<Lobby | null> {
  const { data, error } = await supabase
    .from('lobbies')
    .select()
    .eq('code', code.toUpperCase())
    .single()

  if (error) return null
  return data as Lobby
}

export async function getLobbyById(id: string): Promise<Lobby | null> {
  const { data, error } = await supabase
    .from('lobbies')
    .select()
    .eq('id', id)
    .single()

  if (error) return null
  return data as Lobby
}

export async function updateLobbyStatus(
  lobbyId: string,
  status: string,
  currentRound?: number
): Promise<void> {
  const update: Record<string, unknown> = { status }
  if (currentRound !== undefined) update.current_round = currentRound

  const { error } = await supabase
    .from('lobbies')
    .update(update)
    .eq('id', lobbyId)

  if (error) throw error
}

export async function emitLobbyEvent(
  lobbyId: string,
  eventType: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase
    .from('lobby_events')
    .insert({ lobby_id: lobbyId, event_type: eventType, payload })

  if (error) throw error
}

/**
 * Replay the same lobby with preserved strength/skill/resistance ratings.
 * Clears brackets/votes, resets player eliminations, optionally changes
 * character/weapon sets, then re-generates the bracket from existing ratings.
 */
export async function replayWithAttributes(
  lobbyId: string,
  weaponSetId: string,
  characterSetId: string,
  playerIds: string[]
): Promise<void> {
  // 1. Collect existing bracket IDs so we can delete their votes
  const { data: existingBrackets } = await supabase
    .from('brackets')
    .select('id')
    .eq('lobby_id', lobbyId)

  const bracketIds = (existingBrackets ?? []).map((b: { id: string }) => b.id)

  // 2. Delete votes associated with those brackets
  if (bracketIds.length > 0) {
    const { error: voteErr } = await supabase
      .from('votes')
      .delete()
      .in('bracket_id', bracketIds)
    if (voteErr) throw voteErr
  }

  // 3. Delete old brackets
  const { error: bracketErr } = await supabase
    .from('brackets')
    .delete()
    .eq('lobby_id', lobbyId)
  if (bracketErr) throw bracketErr

  // 4. Un-eliminate all players
  const { error: playerErr } = await supabase
    .from('players')
    .update({ is_eliminated: false })
    .eq('lobby_id', lobbyId)
  if (playerErr) throw playerErr

  // 5. Update lobby with (potentially new) sets and reset round counter
  const { error: lobbyErr } = await supabase
    .from('lobbies')
    .update({ weapon_set_id: weaponSetId, character_set_id: characterSetId, current_round: 0 })
    .eq('id', lobbyId)
  if (lobbyErr) throw lobbyErr

  // 6. Re-compute power scores from the preserved ratings
  const scores = await savePowerScores(playerIds, lobbyId)

  // 7. Fetch weapons for the (possibly new) weapon set
  const weapons = await getWeaponsForLobby(weaponSetId)

  // 8. Generate a fresh bracket
  const brackets = await generateBracket(lobbyId, scores, weapons)

  // 9. Open first match and drive all players to voting
  const firstMatch = brackets
    .filter(b => b.round_number === 1)
    .find(b => b.player1_id && b.player2_id)

  if (firstMatch) {
    await openMatch(firstMatch.id)
    await updateLobbyStatus(lobbyId, 'voting')
    await emitLobbyEvent(lobbyId, 'match_opened', { match_id: firstMatch.id })
  } else {
    await updateLobbyStatus(lobbyId, 'bracket')
    await emitLobbyEvent(lobbyId, 'bracket_generated', {})
  }
}
