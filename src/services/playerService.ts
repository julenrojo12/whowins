import { supabase } from '../lib/supabase'
import type { Player, Character } from '../types/game'

export async function addHumanPlayer(
  lobbyId: string,
  sessionId: string,
  name: string,
  photoUrl: string | null,
  slotNumber: number
): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .insert({
      lobby_id: lobbyId,
      session_id: sessionId,
      player_type: 'human',
      name,
      photo_url: photoUrl,
      slot_number: slotNumber,
      is_eliminated: false,
    })
    .select()
    .single()

  if (error) throw error
  return data as Player
}

export async function addBotPlayer(
  lobbyId: string,
  character: Character,
  slotNumber: number
): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .insert({
      lobby_id: lobbyId,
      session_id: null,
      player_type: 'bot',
      name: character.name,
      photo_url: character.image_url,
      slot_number: slotNumber,
      is_eliminated: false,
    })
    .select()
    .single()

  if (error) throw error
  return data as Player
}

export async function getPlayersForLobby(lobbyId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select()
    .eq('lobby_id', lobbyId)
    .order('slot_number')

  if (error) throw error
  return (data as Player[]) ?? []
}

export async function getPlayerBySession(lobbyId: string, sessionId: string): Promise<Player | null> {
  const { data, error } = await supabase
    .from('players')
    .select()
    .eq('lobby_id', lobbyId)
    .eq('session_id', sessionId)
    .single()

  if (error) return null
  return data as Player
}

export async function eliminatePlayer(playerId: string): Promise<void> {
  const { error } = await supabase
    .from('players')
    .update({ is_eliminated: true })
    .eq('id', playerId)

  if (error) throw error
}
