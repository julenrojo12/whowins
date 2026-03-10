export interface CharacterSet {
  id: string
  name: string
  created_at: string
}

export interface Character {
  id: string
  set_id: string
  name: string
  image_url: string | null
  created_at: string
}

export interface WeaponSet {
  id: string
  name: string
  created_at: string
}

export interface Weapon {
  id: string
  set_id: string
  name: string
  image_url: string | null
  danger_level: number  // 1-10 internal, displayed as 1-5 stars
  created_at: string
}

export interface Lobby {
  id: string
  code: string
  host_session_id: string
  format: number
  character_set_id: string | null
  weapon_set_id: string | null
  status: string
  current_round: number
  created_at: string
}

export interface Player {
  id: string
  lobby_id: string
  session_id: string | null
  player_type: 'human' | 'bot'
  name: string
  photo_url: string | null
  slot_number: number
  is_eliminated: boolean
  created_at: string
}

export interface Rating {
  id: string
  lobby_id: string
  rater_id: string
  target_id: string
  strength: number
  skill: number
  resistance: number
  created_at: string
}

export interface PlayerPowerScore {
  player_id: string
  avg_strength: number
  avg_skill: number
  avg_resistance: number
  power_score: number
  bracket_seed: number
}

export interface BracketMatch {
  id: string
  lobby_id: string
  round_number: number
  match_number: number
  player1_id: string | null
  player2_id: string | null
  weapon1_id: string | null
  weapon2_id: string | null
  status: string
  winner_id: string | null
  created_at: string
}

export interface Vote {
  id: string
  bracket_id: string
  voter_id: string
  voted_for_id: string
  created_at: string
}

export interface LobbyEvent {
  id: string
  lobby_id: string
  event_type: string
  payload: Record<string, unknown>
  created_at: string
}

// Rich types with joined data
export interface PlayerWithScore extends Player {
  power_score?: PlayerPowerScore
}

export interface MatchWithPlayers extends BracketMatch {
  player1?: Player | null
  player2?: Player | null
  weapon1?: Weapon | null
  weapon2?: Weapon | null
}
