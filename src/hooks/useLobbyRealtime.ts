import { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGameStore } from '../store'
import { getSavedLobbyId } from '../lib/session'
import { getLobbyById } from '../services/lobbyService'
import { getPlayersForLobby } from '../services/playerService'
import { getRatingsForLobby } from '../services/ratingService'
import { getBrackets } from '../services/bracketService'
import { getVotesForLobby } from '../services/voteService'
import type { Lobby, Player, Rating, BracketMatch, Vote, LobbyEvent } from '../types/game'

export function useLobbyRealtime(lobbyId: string | null) {
  const navigate = useNavigate()
  const {
    setLobby, setPlayers, setRatings, setBrackets, setVotes,
    upsertPlayer, upsertRating, upsertBracket, upsertVote,
    lobby, setVotingStartedEvent, setConnectionStatus,
  } = useGameStore()

  // Resolve effective lobby ID: prop first, then localStorage fallback (survives F5)
  const effectiveLobbyId = lobbyId ?? getSavedLobbyId()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const mountedRef = useRef(true)

  // Bootstrap lobby from DB if store is empty after a page refresh
  useEffect(() => {
    if (lobby || !effectiveLobbyId) return
    getLobbyById(effectiveLobbyId).then(l => {
      if (l && mountedRef.current) setLobby(l)
    })
  }, [effectiveLobbyId])

  // Resync all game state from DB — fills any events missed while disconnected
  const resync = useCallback(async (id: string) => {
    const [freshLobby, players, ratings, brackets, votes] = await Promise.all([
      getLobbyById(id),
      getPlayersForLobby(id),
      getRatingsForLobby(id),
      getBrackets(id),
      getVotesForLobby(id),
    ])
    if (!mountedRef.current) return
    if (freshLobby) {
      setLobby(freshLobby)
      handleNavigation(freshLobby.status, navigate)
    }
    setPlayers(players)
    setRatings(ratings)
    setBrackets(brackets)
    setVotes(votes)
  }, [navigate])

  // Build (or rebuild) a channel with all subscriptions + health monitoring
  const buildChannel = useCallback((id: string) => {
    const ch = supabase
      .channel(`lobby:${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lobbies', filter: `id=eq.${id}` },
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
          if (player?.lobby_id === id) upsertPlayer(player)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ratings' },
        (payload) => {
          const rating = payload.new as Rating
          if (rating?.lobby_id === id) upsertRating(rating)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'brackets' },
        (payload) => {
          const bracket = payload.new as BracketMatch
          if (bracket?.lobby_id === id) upsertBracket(bracket)
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
          if (event?.lobby_id !== id) return
          if (event.event_type === 'voting_started') {
            setVotingStartedEvent(event.payload as { match_id: string; started_at: number })
          }
        }
      )
      .subscribe(async (status) => {
        if (!mountedRef.current) return
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('reconnecting')
          // Brief wait before rebuilding to avoid hot-loop on a still-broken network
          await new Promise(r => setTimeout(r, 2000))
          if (!mountedRef.current) return
          if (channelRef.current) await supabase.removeChannel(channelRef.current)
          channelRef.current = buildChannel(id)
          await resync(id)
        }
        // CLOSED fires when we explicitly removeChannel — not treated as an error
      })
    return ch
  }, [navigate, resync])

  // Main subscription effect
  useEffect(() => {
    if (!effectiveLobbyId) return
    mountedRef.current = true

    channelRef.current = buildChannel(effectiveLobbyId)

    // Tab becomes visible again: always rebuild to avoid stale WS after OS/browser suspension
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      if (!mountedRef.current || !effectiveLobbyId) return
      setConnectionStatus('reconnecting')
      const old = channelRef.current
      if (old) supabase.removeChannel(old)
      channelRef.current = buildChannel(effectiveLobbyId)
      resync(effectiveLobbyId)
    }

    // Network restored: reconnect and fill missed events
    function handleOnline() {
      if (!mountedRef.current || !effectiveLobbyId) return
      setConnectionStatus('reconnecting')
      const old = channelRef.current
      if (old) supabase.removeChannel(old)
      channelRef.current = buildChannel(effectiveLobbyId)
      resync(effectiveLobbyId)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)

    return () => {
      mountedRef.current = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [effectiveLobbyId])

  // Also navigate if lobby status changed before subscribe (bootstrap path)
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
