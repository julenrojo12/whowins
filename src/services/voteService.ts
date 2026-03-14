import { supabase } from '../lib/supabase'
import type { Vote, BracketMatch } from '../types/game'

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

/**
 * 2v2 winner determination.
 * Votes are cast for the team representative (player1_id = Team A, player2_id = Team B).
 * Returns: winning pair (winner + partner) and losing pair (loser1 + loser2).
 */
export function determineWinner2v2(
  votes: Vote[],
  match: BracketMatch
): { winnerId: string; partnerId: string; loserId1: string; loserId2: string } {
  const p1Id = match.player1_id!
  const p2Id = match.player2_id!
  const p3Id = match.player3_id!
  const p4Id = match.player4_id!

  const tally = tallyVotes(votes)
  const teamAVotes = tally[p1Id] ?? 0
  const teamBVotes = tally[p2Id] ?? 0

  if (teamAVotes >= teamBVotes) {
    return { winnerId: p1Id, partnerId: p3Id, loserId1: p2Id, loserId2: p4Id }
  }
  return { winnerId: p2Id, partnerId: p4Id, loserId1: p1Id, loserId2: p3Id }
}
