import { supabase } from '../lib/supabase'
import type { Team, PlayerPowerScore } from '../types/game'
import { formBalancedTeams } from '../algorithms/teamFormation'

export async function formAndSaveTeams(
  lobbyId: string,
  scores: PlayerPowerScore[]
): Promise<{ teams: Team[]; teamCompositions: ReturnType<typeof formBalancedTeams> }> {
  const compositions = formBalancedTeams(scores)

  // Insert teams
  const teamRows = compositions.map(c => ({
    lobby_id:  lobbyId,
    team_slot: c.teamSlot,
  }))

  const { data: teamData, error: teamError } = await supabase
    .from('teams')
    .insert(teamRows)
    .select()

  if (teamError) throw teamError
  const teams = teamData as Team[]

  // Assign team_id to each player
  for (let i = 0; i < compositions.length; i++) {
    const comp = compositions[i]
    const team = teams[i]
    const { error } = await supabase
      .from('players')
      .update({ team_id: team.id })
      .in('id', [comp.player_a_id, comp.player_b_id])
    if (error) throw error
  }

  // Attach team IDs back to compositions for downstream use
  const enrichedCompositions = compositions.map((c, i) => ({
    ...c,
    team_id: teams[i].id,
  }))

  return { teams, teamCompositions: enrichedCompositions }
}

export async function getTeamsForLobby(lobbyId: string): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select()
    .eq('lobby_id', lobbyId)
    .order('team_slot')

  if (error) throw error
  return (data as Team[]) ?? []
}
