import { supabase } from '../lib/supabase'
import type { Vote } from '../types/game'

export async function castVote(
  bracketId: string,
  voterId: string,
  votedForId: string
): Promise<Vote> {
  const { data, error } = await supabase
    .from('votes')
    .upsert(
      { bracket_id: bracketId, voter_id: voterId, voted_for_id: votedForId },
      { onConflict: 'bracket_id,voter_id' }
    )
    .select()
    .single()

  if (error) throw error
  return data as Vote
}

export async function getVotesForBracket(bracketId: string): Promise<Vote[]> {
  const { data, error } = await supabase
    .from('votes')
    .select()
    .eq('bracket_id', bracketId)

  if (error) throw error
  return (data as Vote[]) ?? []
}

export async function getVotesForLobby(lobbyId: string): Promise<Vote[]> {
  // Join via brackets to get all votes for the lobby
  const { data, error } = await supabase
    .from('votes')
    .select('*, brackets!inner(lobby_id)')
    .eq('brackets.lobby_id', lobbyId)

  if (error) throw error
  return ((data as unknown[]) ?? []).map((v: unknown) => {
    const vote = v as Vote & { brackets: unknown }
    const { brackets: _, ...rest } = vote
    return rest as Vote
  })
}

/** Count votes per candidate for a bracket match */
export function tallyVotes(votes: Vote[]): Record<string, number> {
  const tally: Record<string, number> = {}
  for (const v of votes) {
    tally[v.voted_for_id] = (tally[v.voted_for_id] ?? 0) + 1
  }
  return tally
}

/** Determine winner by vote count (most votes wins) */
export function determineWinner(
  votes: Vote[],
  player1Id: string,
  player2Id: string
): string {
  const tally = tallyVotes(votes)
  const p1    = tally[player1Id] ?? 0
  const p2    = tally[player2Id] ?? 0
  if (p1 >= p2) return player1Id
  return player2Id
}
