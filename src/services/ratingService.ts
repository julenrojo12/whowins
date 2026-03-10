import { supabase } from '../lib/supabase'
import type { Rating } from '../types/game'

export async function upsertRating(
  lobbyId: string,
  raterId: string,
  targetId: string,
  strength: number,
  skill: number,
  resistance: number
): Promise<void> {
  const { error } = await supabase
    .from('ratings')
    .upsert(
      { lobby_id: lobbyId, rater_id: raterId, target_id: targetId, strength, skill, resistance },
      { onConflict: 'rater_id,target_id' }
    )

  if (error) throw error
}

export async function getRatingsForLobby(lobbyId: string): Promise<Rating[]> {
  const { data, error } = await supabase
    .from('ratings')
    .select()
    .eq('lobby_id', lobbyId)

  if (error) throw error
  return (data as Rating[]) ?? []
}

export async function hasRaterCompletedAll(
  lobbyId: string,
  raterId: string,
  totalTargets: number
): Promise<boolean> {
  const { count, error } = await supabase
    .from('ratings')
    .select('id', { count: 'exact', head: true })
    .eq('lobby_id', lobbyId)
    .eq('rater_id', raterId)

  if (error) return false
  return (count ?? 0) >= totalTargets
}
