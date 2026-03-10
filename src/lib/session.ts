const SESSION_KEY = 'whowins_session'

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
