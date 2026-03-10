import { supabase } from '../lib/supabase'
import { generateLobbyCode } from '../lib/utils'
import type { Lobby } from '../types/game'

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
