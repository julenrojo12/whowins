import { create } from 'zustand'
import type { Lobby, Player, BracketMatch, Vote, Rating, PlayerPowerScore, Weapon } from '../types/game'

export type Lang = 'en' | 'es'

function loadLang(): Lang {
  try { return (localStorage.getItem('whowins_lang') as Lang) ?? 'es' } catch { return 'es' }
}

interface GameStore {
  // Language
  lang: Lang
  setLang: (lang: Lang) => void

  // Lobby
  lobby: Lobby | null
  setLobby: (lobby: Lobby | null) => void

  // Players
  players: Player[]
  setPlayers: (players: Player[]) => void
  upsertPlayer: (player: Player) => void

  // Ratings
  ratings: Rating[]
  setRatings: (ratings: Rating[]) => void
  upsertRating: (rating: Rating) => void

  // Power scores
  powerScores: PlayerPowerScore[]
  setPowerScores: (scores: PlayerPowerScore[]) => void

  // Brackets
  brackets: BracketMatch[]
  setBrackets: (brackets: BracketMatch[]) => void
  upsertBracket: (bracket: BracketMatch) => void

  // Votes
  votes: Vote[]
  setVotes: (votes: Vote[]) => void
  upsertVote: (vote: Vote) => void

  // Weapons (for current lobby)
  weapons: Weapon[]
  setWeapons: (weapons: Weapon[]) => void

  // Active match (for match page)
  activeMatchId: string | null
  setActiveMatchId: (id: string | null) => void

  // Reset all game state
  resetGame: () => void
}

const initialState = {
  lobby: null,
  players: [],
  ratings: [],
  powerScores: [],
  brackets: [],
  votes: [],
  weapons: [],
  activeMatchId: null,
}

export const useGameStore = create<GameStore>((set) => ({
  lang: loadLang(),
  setLang: (lang) => {
    try { localStorage.setItem('whowins_lang', lang) } catch {}
    set({ lang })
  },

  ...initialState,

  setLobby: (lobby) => set({ lobby }),

  setPlayers: (players) => set({ players }),
  upsertPlayer: (player) => set(state => {
    const idx = state.players.findIndex(p => p.id === player.id)
    if (idx >= 0) {
      const updated = [...state.players]
      updated[idx] = player
      return { players: updated }
    }
    return { players: [...state.players, player] }
  }),

  setRatings: (ratings) => set({ ratings }),
  upsertRating: (rating) => set(state => {
    const idx = state.ratings.findIndex(r => r.id === rating.id)
    if (idx >= 0) {
      const updated = [...state.ratings]
      updated[idx] = rating
      return { ratings: updated }
    }
    return { ratings: [...state.ratings, rating] }
  }),

  setPowerScores: (powerScores) => set({ powerScores }),

  setBrackets: (brackets) => set({ brackets }),
  upsertBracket: (bracket) => set(state => {
    const idx = state.brackets.findIndex(b => b.id === bracket.id)
    if (idx >= 0) {
      const updated = [...state.brackets]
      updated[idx] = bracket
      return { brackets: updated }
    }
    return { brackets: [...state.brackets, bracket] }
  }),

  setVotes: (votes) => set({ votes }),
  upsertVote: (vote) => set(state => {
    const idx = state.votes.findIndex(v => v.id === vote.id)
    if (idx >= 0) {
      const updated = [...state.votes]
      updated[idx] = vote
      return { votes: updated }
    }
    return { votes: [...state.votes, vote] }
  }),

  setWeapons: (weapons) => set({ weapons }),
  setActiveMatchId: (activeMatchId) => set({ activeMatchId }),

  resetGame: () => set(initialState),
}))
