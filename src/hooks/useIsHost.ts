import { useGameStore } from '../store'
import { useSession } from './useSession'

export function useIsHost(): boolean {
  const lobby = useGameStore(s => s.lobby)
  const sessionId = useSession()
  return lobby?.host_session_id === sessionId
}
