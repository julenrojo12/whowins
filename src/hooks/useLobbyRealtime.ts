import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGameStore } from '../store'
import { getSavedLobbyId } from '../lib/session'
import { getLobbyById } from '../services/lobbyService'
import type { Lobby, Player, Rating, BracketMatch, Vote, LobbyEvent } from '../types/game'

export function useLobbyRealtime(lobbyId: string | null) {
  const navigate = useNavigate()
  const {
    setLobby, upsertPlayer, upsertRating, upsertBracket, upsertVote,
    lobby,
  } = useGameStore()

  // Resolve effective lobby ID: prop first, then localStorage fallback (survives F5)
  const effectiveLobbyId = lobbyId ?? getSavedLobbyId()

  // Bootstrap lobby from DB if store is empty after a page refresh
  useEffect(() => {
    if (lobby || !effectiveLobbyId) return
    getLobbyById(effectiveLobbyId).then(l => {
      if (l) setLobby(l)
    })
  }, [effectiveLobbyId])

  useEffect(() => {
    if (!effectiveLobbyId) return

    const channel = supabase
      .channel(`lobby:${effectiveLobbyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lobbies', filter: `id=eq.${effectiveLobbyId}` },
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
          if (player?.lobby_id === effectiveLobbyId) upsertPlayer(player)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ratings' },
        (payload) => {
          const rating = payload.new as Rating
          if (rating?.lobby_id === effectiveLobbyId) upsertRating(rating)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'brackets' },
        (payload) => {
          const bracket = payload.new as BracketMatch
          if (bracket?.lobby_id === effectiveLobbyId) upsertBracket(bracket)
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
          if (event?.lobby_id === effectiveLobbyId) console.log('[lobby_event]', event.event_type, event.payload)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [effectiveLobbyId])

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
