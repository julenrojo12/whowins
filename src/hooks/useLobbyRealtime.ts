import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGameStore } from '../store'
import type { Lobby, Player, Rating, BracketMatch, Vote, LobbyEvent } from '../types/game'

export function useLobbyRealtime(lobbyId: string | null) {
  const navigate = useNavigate()
  const {
    setLobby, upsertPlayer, upsertRating, upsertBracket, upsertVote,
    lobby,
  } = useGameStore()

  useEffect(() => {
    if (!lobbyId) return

    const channel = supabase
      .channel(`lobby:${lobbyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
        (payload) => {
          const updated = payload.new as Lobby
          setLobby(updated)
          handleNavigation(updated.status, navigate)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        (payload) => {
          const player = payload.new as Player
          if (player?.lobby_id === lobbyId) upsertPlayer(player)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ratings' },
        (payload) => {
          const rating = payload.new as Rating
          if (rating?.lobby_id === lobbyId) upsertRating(rating)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'brackets' },
        (payload) => {
          const bracket = payload.new as BracketMatch
          if (bracket?.lobby_id === lobbyId) upsertBracket(bracket)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes' },
        (payload) => {
          const vote = payload.new as Vote
          if (vote?.bracket_id) upsertVote(vote)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lobby_events' },
        (_payload) => {
          const event = _payload.new as LobbyEvent
          if (event?.lobby_id === lobbyId) console.log('[lobby_event]', event.event_type, event.payload)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [lobbyId])

  // Also navigate if lobby status changed before subscribe
  useEffect(() => {
    if (lobby) handleNavigation(lobby.status, navigate)
  }, [lobby?.status])
}

function handleNavigation(status: string, navigate: ReturnType<typeof useNavigate>) {
  switch (status) {
    case 'rating':         navigate('/rate');    break
    case 'bracket':        navigate('/bracket'); break
    case 'voting':         navigate('/match');   break
    case 'between_rounds': navigate('/bracket'); break
    case 'finished':       navigate('/results'); break
  }
}
