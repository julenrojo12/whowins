const SESSION_KEY = 'whowins_session'
const LOBBY_KEY   = 'whowins_lobby'

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function saveLobbyId(id: string): void {
  try { localStorage.setItem(LOBBY_KEY, id) } catch {}
}

export function getSavedLobbyId(): string | null {
  try { return localStorage.getItem(LOBBY_KEY) } catch { return null }
}

export function clearLobbyId(): void {
  try { localStorage.removeItem(LOBBY_KEY) } catch {}
}
