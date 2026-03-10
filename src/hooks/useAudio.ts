import { useEffect } from 'react'
import { unlockAudio, startMusic, stopMusic } from '../audio/audioEngine'
import { sfx } from '../audio/sounds'

export function useAudio() {
  return { sfx, startMusic, stopMusic }
}

/** Unlock AudioContext on first user interaction */
export function useAudioUnlock() {
  useEffect(() => {
    const handler = () => unlockAudio()
    document.addEventListener('click', handler, { once: true })
    document.addEventListener('keydown', handler, { once: true })
    return () => {
      document.removeEventListener('click', handler)
      document.removeEventListener('keydown', handler)
    }
  }, [])
}

export function useLobbyMusic(phase: 'lobby' | 'rating' | 'battle' | null) {
  useEffect(() => {
    if (!phase) return
    startMusic(phase)
    return () => stopMusic()
  }, [phase])
}
