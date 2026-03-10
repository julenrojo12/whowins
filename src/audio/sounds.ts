import { playTone, playNoise } from './audioEngine'

export const sfx = {
  menuSelect() {
    playTone(440, 'square', 0.06, 0.1)
  },

  menuConfirm() {
    playTone(523, 'square', 0.08, 0.15)
    playTone(659, 'square', 0.08, 0.12, 0.08)
  },

  playerJoined() {
    playTone(392, 'square', 0.08, 0.12)
    playTone(523, 'square', 0.08, 0.12, 0.09)
    playTone(659, 'square', 0.12, 0.12, 0.18)
  },

  starFill(starIdx: number) {
    const freqs = [261, 294, 330, 370, 415]
    const freq = freqs[Math.min(starIdx, freqs.length - 1)]
    playTone(freq, 'triangle', 0.08, 0.1)
  },

  vsSlam() {
    playTone(65, 'sawtooth', 0.2, 0.25)
    playNoise(0.15, 0.15)
    setTimeout(() => playTone(55, 'sawtooth', 0.3, 0.2), 100)
  },

  voteCast() {
    playTone(880, 'square', 0.04, 0.08)
  },

  matchClose() {
    playTone(392, 'square', 0.1, 0.15)
    playTone(523, 'square', 0.1, 0.12, 0.12)
  },

  knockout() {
    // KO melody
    const notes = [523, 494, 440, 392, 349, 294]
    notes.forEach((freq, i) => {
      playTone(freq, 'sawtooth', 0.12, 0.2, i * 0.1)
    })
    playNoise(0.3, 0.1)
  },

  winner() {
    // Victory fanfare
    const melody = [523, 523, 523, 415, 523, 659, 698]
    melody.forEach((freq, i) => {
      playTone(freq, 'square', 0.15, 0.2, i * 0.12)
    })
    setTimeout(() => {
      playTone(698, 'square', 0.5, 0.25)
    }, melody.length * 120)
  },

  error() {
    playTone(220, 'sawtooth', 0.1, 0.15)
    playTone(196, 'sawtooth', 0.1, 0.15, 0.1)
  },
}
