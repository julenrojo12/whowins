import { useMemo } from 'react'
import { getSessionId } from '../lib/session'

export function useSession() {
  const sessionId = useMemo(() => getSessionId(), [])
  return sessionId
}
