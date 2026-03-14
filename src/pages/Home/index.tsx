import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Home.module.css'
import { ArcadeButton } from '../../components/ui/ArcadeButton'
import { ArcadeInput } from '../../components/ui/ArcadeInput'
import { ArcadeFrame } from '../../components/layout/ArcadeFrame'
import { Modal } from '../../components/ui/Modal'
import { createLobby, getLobbyByCode } from '../../services/lobbyService'
import { getCharacterSets, getWeaponSets } from '../../services/setsService'
import { useSession } from '../../hooks/useSession'
import { useGameStore } from '../../store'
import { LOBBY_FORMATS } from '../../lib/constants'
import type { CharacterSet, WeaponSet } from '../../types/game'
import { useLobbyMusic } from '../../hooks/useAudio'
import { useT } from '../../i18n'
import type { Lang } from '../../store'

export function HomePage() {
  const navigate  = useNavigate()
  const sessionId = useSession()
  const setLobby  = useGameStore(s => s.setLobby)
  const lang      = useGameStore(s => s.lang)
  const setLang   = useGameStore(s => s.setLang)
  useLobbyMusic('lobby')
  const t = useT()

  const [joinCode, setJoinCode]         = useState('')
  const [joinError, setJoinError]       = useState('')
  const [showCreate, setShowCreate]     = useState(false)
  const [creating, setCreating]         = useState(false)
  const [joining, setJoining]           = useState(false)

  // Create form state
  const [format, setFormat]             = useState<number>(4)
  const [charSets, setCharSets]         = useState<CharacterSet[]>([])
  const [weapSets, setWeapSets]         = useState<WeaponSet[]>([])
  const [charSetId, setCharSetId]       = useState('')
  const [weapSetId, setWeapSetId]       = useState('') // '' = all weapons
  const [loadingSets, setLoadingSets]   = useState(false)

  async function openCreate() {
    setShowCreate(true)
    setLoadingSets(true)
    try {
      const [cs, ws] = await Promise.all([getCharacterSets(), getWeaponSets()])
      setCharSets(cs)
      setWeapSets(ws)
      if (cs.length) setCharSetId(cs[0].id)
      // Keep '' (all weapons) as default; don't force-select a specific set
    } finally {
      setLoadingSets(false)
    }
  }

  async function handleCreate() {
    if (!charSetId) return
    setCreating(true)
    try {
      const lobby = await createLobby(sessionId, format, charSetId, weapSetId || null)
      setLobby(lobby)
      navigate(`/lobby/${lobby.code}`)
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 6) { setJoinError(t('home.codeError')); return }
    setJoining(true)
    setJoinError('')
    try {
      const lobby = await getLobbyByCode(code)
      if (!lobby) { setJoinError(t('home.lobbyNotFound')); return }
      setLobby(lobby)
      navigate(`/lobby/${lobby.code}`)
    } catch {
      setJoinError(t('home.connectError'))
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.title}>WHO<br/>WINS</h1>
        <p className={styles.edition}>SHPR EDITION</p>
      </div>

      <ArcadeFrame className={styles.card}>
        <div className={styles.actions}>
          <ArcadeButton size="lg" variant="yellow" onClick={openCreate}>
            {t('home.hostGame')}
          </ArcadeButton>

          <div className={styles.joinRow}>
            <ArcadeInput
              placeholder={t('home.codePlaceholder')}
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              error={joinError}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            <ArcadeButton variant="blue" loading={joining} onClick={handleJoin}>
              {t('home.join')}
            </ArcadeButton>
          </div>

          <div className={styles.langRow}>
            <span className={styles.langLabel}>{t('home.language')}:</span>
            {(['en', 'es'] as Lang[]).map(l => (
              <button
                key={l}
                className={[styles.langBtn, lang === l ? styles.langActive : ''].join(' ')}
                onClick={() => setLang(l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </ArcadeFrame>

      {/* Create Lobby Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title={t('home.createLobby')}>
        {loadingSets ? (
          <p className="text-dim text-ui">{t('home.loadingSets')}</p>
        ) : (
          <div className={styles.createForm}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>{t('home.format')}</label>
              <div className={styles.formatGrid}>
                {LOBBY_FORMATS.map(f => (
                  <ArcadeButton
                    key={f}
                    size="sm"
                    variant={format === f ? 'yellow' : 'ghost'}
                    onClick={() => setFormat(f)}
                  >
                    {f}P
                  </ArcadeButton>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>{t('home.characterSet')}</label>
              {charSets.length === 0
                ? <p className="text-dim text-ui">{t('home.noCharSets')} <a onClick={() => navigate('/sets')}>{t('home.createOne')}</a></p>
                : (
                  <select
                    className={styles.select}
                    value={charSetId}
                    onChange={e => setCharSetId(e.target.value)}
                  >
                    {charSets.map(cs => (
                      <option key={cs.id} value={cs.id}>{cs.name}</option>
                    ))}
                  </select>
                )
              }
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>{t('home.weaponSet')}</label>
              {weapSets.length === 0
                ? (
                  <select className={styles.select} value="" disabled>
                    <option value="">{t('home.allWeapons')}</option>
                  </select>
                )
                : (
                  <select
                    className={styles.select}
                    value={weapSetId}
                    onChange={e => setWeapSetId(e.target.value)}
                  >
                    <option value="">{t('home.allWeapons')}</option>
                    {weapSets.map(ws => (
                      <option key={ws.id} value={ws.id}>{ws.name}</option>
                    ))}
                  </select>
                )
              }
            </div>

            <ArcadeButton
              variant="yellow"
              loading={creating}
              disabled={!charSetId}
              onClick={handleCreate}
            >
              {t('home.createLobbyBtn')}
            </ArcadeButton>
          </div>
        )}
      </Modal>
      <footer className={styles.footer}>
        <span className={styles.devSignature}>Dev Julos</span>
      </footer>
    </div>
  )
}
