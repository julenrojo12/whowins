export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      character_sets: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string; created_at?: string }
        Update: { id?: string; name?: string }
      }
      characters: {
        Row: { id: string; set_id: string; name: string; image_url: string | null; created_at: string }
        Insert: { id?: string; set_id: string; name: string; image_url?: string | null; created_at?: string }
        Update: { id?: string; set_id?: string; name?: string; image_url?: string | null }
      }
      weapon_sets: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string; created_at?: string }
        Update: { id?: string; name?: string }
      }
      weapons: {
        Row: { id: string; set_id: string; name: string; image_url: string | null; danger_level: number; created_at: string }
        Insert: { id?: string; set_id: string; name: string; image_url?: string | null; danger_level: number; created_at?: string }
        Update: { id?: string; set_id?: string; name?: string; image_url?: string | null; danger_level?: number }
      }
      lobbies: {
        Row: {
          id: string; code: string; host_session_id: string
          format: number; character_set_id: string | null; weapon_set_id: string | null
          status: string; current_round: number; created_at: string
        }
        Insert: {
          id?: string; code: string; host_session_id: string
          format: number; character_set_id?: string | null; weapon_set_id?: string | null
          status?: string; current_round?: number; created_at?: string
        }
        Update: {
          id?: string; code?: string; host_session_id?: string
          format?: number; character_set_id?: string | null; weapon_set_id?: string | null
          status?: string; current_round?: number
        }
      }
      players: {
        Row: {
          id: string; lobby_id: string; session_id: string | null; player_type: string
          name: string; photo_url: string | null; slot_number: number; is_eliminated: boolean; created_at: string
        }
        Insert: {
          id?: string; lobby_id: string; session_id?: string | null; player_type?: string
          name: string; photo_url?: string | null; slot_number: number; is_eliminated?: boolean; created_at?: string
        }
        Update: {
          id?: string; lobby_id?: string; session_id?: string | null; player_type?: string
          name?: string; photo_url?: string | null; slot_number?: number; is_eliminated?: boolean
        }
      }
      ratings: {
        Row: {
          id: string; lobby_id: string; rater_id: string; target_id: string
          strength: number; skill: number; resistance: number; created_at: string
        }
        Insert: {
          id?: string; lobby_id: string; rater_id: string; target_id: string
          strength: number; skill: number; resistance: number; created_at?: string
        }
        Update: {
          id?: string; strength?: number; skill?: number; resistance?: number
        }
      }
      player_power_scores: {
        Row: {
          player_id: string; avg_strength: number; avg_skill: number; avg_resistance: number
          power_score: number; bracket_seed: number
        }
        Insert: {
          player_id: string; avg_strength: number; avg_skill: number; avg_resistance: number
          power_score: number; bracket_seed: number
        }
        Update: {
          avg_strength?: number; avg_skill?: number; avg_resistance?: number
          power_score?: number; bracket_seed?: number
        }
      }
      brackets: {
        Row: {
          id: string; lobby_id: string; round_number: number; match_number: number
          player1_id: string | null; player2_id: string | null
          weapon1_id: string | null; weapon2_id: string | null
          status: string; winner_id: string | null; created_at: string
        }
        Insert: {
          id?: string; lobby_id: string; round_number: number; match_number: number
          player1_id?: string | null; player2_id?: string | null
          weapon1_id?: string | null; weapon2_id?: string | null
          status?: string; winner_id?: string | null; created_at?: string
        }
        Update: {
          id?: string; player1_id?: string | null; player2_id?: string | null
          weapon1_id?: string | null; weapon2_id?: string | null
          status?: string; winner_id?: string | null
        }
      }
      votes: {
        Row: { id: string; bracket_id: string; voter_id: string; voted_for_id: string; created_at: string }
        Insert: { id?: string; bracket_id: string; voter_id: string; voted_for_id: string; created_at?: string }
        Update: { id?: string; voted_for_id?: string }
      }
      lobby_events: {
        Row: { id: string; lobby_id: string; event_type: string; payload: Json; created_at: string }
        Insert: { id?: string; lobby_id: string; event_type: string; payload?: Json; created_at?: string }
        Update: Record<string, never>
      }
    }
  }
}
