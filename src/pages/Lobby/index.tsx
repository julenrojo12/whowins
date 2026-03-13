import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import styles from './Lobby.module.css'
import { ArcadeButton } from '../../components/ui/ArcadeButton'
import { ArcadeInput } from '../../components/ui/ArcadeInput'
import { ArcadeFrame } from '../../components/layout/ArcadeFrame'
import { Modal } from '../../components/ui/Modal'
import { PlayerAvatar } from '../../components/game/PlayerAvatar'
import { supabase } from '../../lib/supabase'
import { getLobbyByCode } from '../../services/lobbyService'
import { getPlayersForLobby, addHumanPlayer, addBotPlayer } from '../../services/playerService'
import { getCharactersForSet } from '../../services/setsService'
import { shuffle } from '../../lib/utils'
import { uploadPlayerPhoto } from '../../services/storageService'
import { updateLobbyStatus, emitLobbyEvent } from '../../services/lobbyService'
import { useSession } from '../../hooks/useSession'
import { useIsHost } from '../../hooks/useIsHost'
import { useGameStore } from '../../store'
import { useLobbyRealtime } from '../../hooks/useLobbyRealtime'
import { useLobbyMusic } from '../../hooks/useAudio'
import { sfx } from '../../audio/sounds'
import { copyToClipboard } from '../../lib/utils'
import { useT } from '../../i18n'

export function LobbyPage() {
  const { code }  = useParams<{ code: string }>()
  const sessionId = useSession()
  const isHost    = useIsHost()
  const { lobby, players, setLobby, setPlayers, upsertPlayer } = useGameStore()
  useLobbyRealtime(lobby?.id ?? null)
  useLobbyMusic('lobby')
  const t = useT()

  const [showJoin, setShowJoin]     = useState(false)
  const [name, setName]             = useState('')
  const [photo, setPhoto]           = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [joining, setJoining]       = useState(false)
  const [starting, setStarting]     = useState(false)
  const [copied, setCopied]         = useState(false)
  const [joinError, setJoinError]   = useState('')
  const fileRef   = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  // Load lobby data on mount
  useEffect(() => {
    if (!code) return
    getLobbyByCode(code).then(l => {
      if (l) setLobby(l)
    })
  }, [code])

  useEffect(() => {
    if (!lobby) return
    getPlayersForLobby(lobby.id).then(setPlayers)
  }, [lobby?.id])

  // Check if this session already joined
  const myPlayer = players.find(p => p.session_id === sessionId)
  const needsJoin = !myPlayer && lobby?.status === 'waiting'

  useEffect(() => {
    if (needsJoin) setShowJoin(true)
  }, [needsJoin])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleJoin() {
    if (!lobby || !name.trim()) { setJoinError(t('lobby.nameError')); return }
    setJoining(true)
    setJoinError('')
    try {
      const slotNumber = players.length + 1
      const p = await addHumanPlayer(lobby.id, sessionId, name.trim(), null, slotNumber)
      let photoUrl: string | null = null
      if (photo) {
        photoUrl = await uploadPlayerPhoto(photo, p.id)
        await supabase.from('players').update({ photo_url: photoUrl }).eq('id', p.id)
      }
      upsertPlayer({ ...p, photo_url: photoUrl })
      sfx.playerJoined()
      setShowJoin(false)
    } catch (e) {
      setJoinError(t('lobby.joinError'))
      console.error(e)
    } finally {
      setJoining(false)
    }
  }

  async function handleStartGame() {
    if (!lobby) return
    setStarting(true)
    try {
      const format = lobby.format
      const humanCount = players.length
      const botsNeeded = format - humanCount

      if (botsNeeded > 0 && lobby.character_set_id) {
        const chars = await getCharactersForSet(lobby.character_set_id)
        const available = shuffle(chars.filter(c => !players.some(p => p.name === c.name)))
        for (let i = 0; i < botsNeeded && i < available.length; i++) {
          await addBotPlayer(lobby.id, available[i], humanCount + i + 1)
        }
      }

      await updateLobbyStatus(lobby.id, 'rating')
      await emitLobbyEvent(lobby.id, 'game_started', {})
    } catch (e) {
      console.error(e)
    } finally {
      setStarting(false)
    }
  }

  async function handleCopyCode() {
    if (!code) return
    await copyToClipboard(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const slots = Array.from({ length: lobby?.format ?? 4 }, (_, i) => players[i] ?? null)
  const humanCount = players.filter(p => p.player_type === 'human').length
  const isSoloMode = humanCount === 1 && isHost
  const canStart = isHost && players.length >= 1 && lobby?.status === 'waiting'

  return (
    <div className={styles.page}>
      <ArcadeFrame
        title={t('lobby.waitingRoom')}
        subtitle={t('lobby.lobbyCode', { code: code ?? '' })}
      >
        <div className={styles.codeRow}>
          <span className={styles.code}>{code}</span>
          <ArcadeButton size="sm" variant="blue" onClick={handleCopyCode}>
            {copied ? t('lobby.copied') : t('lobby.copyCode')}
          </ArcadeButton>
        </div>

        <div className={styles.grid}>
          {slots.map((player, i) => (
            <div key={i} className={[styles.slot, player ? styles.filled : styles.empty].join(' ')}>
              {player
                ? <PlayerAvatar player={player} size="md" showName />
                : <span className={styles.emptySlot}>P{i + 1}</span>
              }
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <p className="text-ui text-dim">
            {t('lobby.playersJoined', { n: players.length, total: lobby?.format ?? '?' })}
          </p>
          {isSoloMode && (
            <p className="text-ui" style={{ color: 'var(--color-accent-gold)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              {t('lobby.soloMode')}
            </p>
          )}
          {isHost && (
            <ArcadeButton
              variant="yellow"
              loading={starting}
              disabled={!canStart}
              onClick={handleStartGame}
            >
              {t('lobby.startGame')}
            </ArcadeButton>
          )}
          {!isHost && !myPlayer && (
            <ArcadeButton variant="green" onClick={() => setShowJoin(true)}>
              {t('lobby.joinGame')}
            </ArcadeButton>
          )}
        </div>
      </ArcadeFrame>

      {/* Join Modal */}
      <Modal isOpen={showJoin} onClose={() => { if (!needsJoin) setShowJoin(false) }} title={t('lobby.joinModal')}>
        <div className={styles.joinForm}>
          <ArcadeInput
            label={t('lobby.yourName')}
            placeholder={t('lobby.namePlaceholder')}
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={20}
            error={joinError}
          />

          <div className={styles.photoSection}>
            <label className={styles.fieldLabel}>{t('lobby.photo')}</label>
            {photoPreview && (
              <img src={photoPreview} className={styles.photoPreview} alt="preview" />
            )}
            <div className={styles.photoButtons}>
              <ArcadeButton size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
                {photo ? t('lobby.changePhoto') : t('lobby.uploadPhoto')}
              </ArcadeButton>
              <ArcadeButton size="sm" variant="blue" onClick={() => cameraRef.current?.click()}>
                {photo ? t('lobby.retakePhoto') : t('lobby.takePhoto')}
              </ArcadeButton>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />
          </div>

          <ArcadeButton
            variant="green"
            loading={joining}
            disabled={!name.trim()}
            onClick={handleJoin}
          >
            {t('lobby.enterArena')}
          </ArcadeButton>
        </div>
      </Modal>
    </div>
  )
}
