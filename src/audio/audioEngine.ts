let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let musicStarted = false

export function getAudioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    masterGain = ctx.createGain()
    masterGain.gain.value = 0.3
    masterGain.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
  return ctx
}

export function getMasterGain(): GainNode {
  getAudioContext()
  return masterGain!
}

export function setMasterVolume(vol: number) {
  if (masterGain) masterGain.gain.value = vol
}

/** Must be called on first user gesture to unlock AudioContext */
export function unlockAudio() {
  getAudioContext()
}

// --- Oscillator helpers ---

export function playTone(
  freq: number,
  type: OscillatorType,
  duration: number,
  volume = 0.2,
  startDelay = 0
) {
  const ctx = getAudioContext()
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(volume, ctx.currentTime + startDelay)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + duration)

  osc.connect(gain)
  gain.connect(getMasterGain())

  osc.start(ctx.currentTime + startDelay)
  osc.stop(ctx.currentTime + startDelay + duration)
}

export function playNoise(duration: number, volume = 0.1) {
  const ctx = getAudioContext()
  const bufSize = ctx.sampleRate * duration
  const buffer  = ctx.createBuffer(1, bufSize, ctx.sampleRate)
  const data    = buffer.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1

  const source = ctx.createBufferSource()
  const gain   = ctx.createGain()
  source.buffer = buffer
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

  source.connect(gain)
  gain.connect(getMasterGain())
  source.start()
}

// --- Background music step sequencer ---

const NOTE = {
  C3: 130.81, E3: 164.81, G3: 196.00, A3: 220.00,
  C4: 261.63, E4: 329.63, G4: 392.00, A4: 440.00,
  C5: 523.25,
}

const LOBBY_SEQ   = [NOTE.C3, NOTE.G3, NOTE.E3, NOTE.A3, NOTE.C4, NOTE.G3, NOTE.E3, NOTE.C3]
const RATING_SEQ  = [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.G4, NOTE.A4, NOTE.G4, NOTE.E4, NOTE.C4]
const BATTLE_SEQ  = [NOTE.C4, NOTE.C4, NOTE.G4, NOTE.C4, NOTE.A3, NOTE.C4, NOTE.E4, NOTE.C5]

let musicPhase: 'lobby' | 'rating' | 'battle' | null = null
let musicTimeout: ReturnType<typeof setTimeout> | null = null

function getSeq(phase: 'lobby' | 'rating' | 'battle') {
  if (phase === 'lobby')   return LOBBY_SEQ
  if (phase === 'rating')  return RATING_SEQ
  return BATTLE_SEQ
}

function stepMusic(phase: 'lobby' | 'rating' | 'battle', step = 0) {
  if (musicPhase !== phase) return
  const seq = getSeq(phase)
  const note = seq[step % seq.length]
  playTone(note, 'square', 0.12, 0.08)
  musicTimeout = setTimeout(() => stepMusic(phase, step + 1), 150)
}

export function startMusic(phase: 'lobby' | 'rating' | 'battle') {
  if (musicPhase === phase && musicStarted) return
  stopMusic()
  musicPhase = phase
  musicStarted = true
  stepMusic(phase)
}

export function stopMusic() {
  musicPhase = null
  musicStarted = false
  if (musicTimeout) { clearTimeout(musicTimeout); musicTimeout = null }
}
