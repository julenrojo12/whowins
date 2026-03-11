import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Sets.module.css'
import { ArcadeButton } from '../../components/ui/ArcadeButton'
import { ArcadeInput } from '../../components/ui/ArcadeInput'
import { ArcadeFrame } from '../../components/layout/ArcadeFrame'
import { Modal } from '../../components/ui/Modal'
import {
  getCharacterSets, createCharacterSet, deleteCharacterSet,
  getCharactersForSet, createCharacter, deleteCharacter,
  getWeaponSets, createWeaponSet, deleteWeaponSet,
  getWeaponsForSet, createWeapon, deleteWeapon,
} from '../../services/setsService'
import { uploadSetImage } from '../../services/storageService'
import { useT } from '../../i18n'
import type { CharacterSet, Character, WeaponSet, Weapon } from '../../types/game'

export function SetsPage() {
  const navigate = useNavigate()
  const t = useT()
  const [tab, setTab] = useState<'characters' | 'weapons'>('characters')

  // Character Sets
  const [charSets, setCharSets]   = useState<CharacterSet[]>([])
  const [activeCS, setActiveCS]   = useState<CharacterSet | null>(null)
  const [chars, setChars]         = useState<Character[]>([])

  // Weapon Sets
  const [weapSets, setWeapSets]   = useState<WeaponSet[]>([])
  const [activeWS, setActiveWS]   = useState<WeaponSet | null>(null)
  const [weapons, setWeapons]     = useState<Weapon[]>([])

  // Modals
  const [newSetName, setNewSetName]   = useState('')
  const [showNewSet, setShowNewSet]   = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newDanger, setNewDanger]     = useState(3)
  const [newItemFile, setNewItemFile] = useState<File | null>(null)
  const [showNewItem, setShowNewItem] = useState(false)
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    loadCharSets()
    loadWeapSets()
  }, [])

  async function loadCharSets() {
    const cs = await getCharacterSets()
    setCharSets(cs)
    if (cs.length && !activeCS) {
      setActiveCS(cs[0])
      loadChars(cs[0].id)
    }
  }

  async function loadChars(setId: string) {
    const c = await getCharactersForSet(setId)
    setChars(c)
  }

  async function loadWeapSets() {
    const ws = await getWeaponSets()
    setWeapSets(ws)
    if (ws.length && !activeWS) {
      setActiveWS(ws[0])
      loadWeapons(ws[0].id)
    }
  }

  async function loadWeapons(setId: string) {
    const w = await getWeaponsForSet(setId)
    setWeapons(w)
  }

  async function handleCreateSet() {
    if (!newSetName.trim()) return
    setSaving(true)
    try {
      if (tab === 'characters') {
        const cs = await createCharacterSet(newSetName.trim())
        setCharSets(prev => [...prev, cs])
        setActiveCS(cs)
        setChars([])
      } else {
        const ws = await createWeaponSet(newSetName.trim())
        setWeapSets(prev => [...prev, ws])
        setActiveWS(ws)
        setWeapons([])
      }
      setNewSetName('')
      setShowNewSet(false)
    } finally { setSaving(false) }
  }

  async function handleDeleteSet(id: string) {
    if (!confirm(t('sets.deleteConfirm'))) return
    if (tab === 'characters') {
      await deleteCharacterSet(id)
      const updated = charSets.filter(cs => cs.id !== id)
      setCharSets(updated)
      if (activeCS?.id === id) {
        setActiveCS(updated[0] ?? null)
        if (updated[0]) loadChars(updated[0].id)
        else setChars([])
      }
    } else {
      await deleteWeaponSet(id)
      const updated = weapSets.filter(ws => ws.id !== id)
      setWeapSets(updated)
      if (activeWS?.id === id) {
        setActiveWS(updated[0] ?? null)
        if (updated[0]) loadWeapons(updated[0].id)
        else setWeapons([])
      }
    }
  }

  async function handleCreateItem() {
    if (!newItemName.trim()) return
    setSaving(true)
    try {
      let imageUrl: string | null = null
      if (newItemFile) {
        imageUrl = await uploadSetImage(newItemFile, newItemName.trim())
      }

      if (tab === 'characters' && activeCS) {
        const c = await createCharacter(activeCS.id, newItemName.trim(), imageUrl)
        setChars(prev => [...prev, c])
      } else if (tab === 'weapons' && activeWS) {
        const w = await createWeapon(activeWS.id, newItemName.trim(), newDanger, imageUrl)
        setWeapons(prev => [...prev, w])
      }

      setNewItemName('')
      setNewDanger(5)
      setNewItemFile(null)
      setShowNewItem(false)
    } finally { setSaving(false) }
  }

  async function handleDeleteChar(id: string) {
    await deleteCharacter(id)
    setChars(prev => prev.filter(c => c.id !== id))
  }

  async function handleDeleteWeapon(id: string) {
    await deleteWeapon(id)
    setWeapons(prev => prev.filter(w => w.id !== id))
  }

  return (
    <div className={styles.page}>
      <ArcadeFrame title={t('sets.title')}>
        <div className={styles.backRow}>
          <ArcadeButton size="sm" variant="ghost" onClick={() => navigate('/')}>
            {t('sets.back')}
          </ArcadeButton>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={[styles.tab, tab === 'characters' ? styles.activeTab : ''].join(' ')}
            onClick={() => setTab('characters')}
          >{t('sets.charSets')}</button>
          <button
            className={[styles.tab, tab === 'weapons' ? styles.activeTab : ''].join(' ')}
            onClick={() => setTab('weapons')}
          >{t('sets.weapSets')}</button>
        </div>

        <div className={styles.layout}>
          {/* Left: set list */}
          <div className={styles.setList}>
            <ArcadeButton size="sm" variant="green" onClick={() => setShowNewSet(true)}>
              {t('sets.newSet')}
            </ArcadeButton>
            {(tab === 'characters' ? charSets : weapSets).map(s => (
              <div
                key={s.id}
                className={[
                  styles.setItem,
                  (tab === 'characters' ? activeCS?.id : activeWS?.id) === s.id ? styles.activeSet : '',
                ].join(' ')}
                onClick={() => {
                  if (tab === 'characters') { setActiveCS(s as CharacterSet); loadChars(s.id) }
                  else { setActiveWS(s as WeaponSet); loadWeapons(s.id) }
                }}
              >
                <span>{s.name}</span>
                <button className={styles.deleteSetBtn} onClick={e => { e.stopPropagation(); handleDeleteSet(s.id) }}>✕</button>
              </div>
            ))}
          </div>

          {/* Right: items */}
          <div className={styles.itemList}>
            {(tab === 'characters' ? activeCS : activeWS) && (
              <>
                <div className={styles.itemHeader}>
                  <h3 className={styles.itemSetName}>
                    {tab === 'characters' ? activeCS?.name : activeWS?.name}
                  </h3>
                  <ArcadeButton size="sm" variant="yellow" onClick={() => setShowNewItem(true)}>
                    {t('sets.add')}
                  </ArcadeButton>
                </div>

                <div className={styles.items}>
                  {tab === 'characters'
                    ? chars.map(c => (
                        <div key={c.id} className={styles.item}>
                          {c.image_url && <img src={c.image_url} alt={c.name} className={styles.itemImg} />}
                          <span className={styles.itemName}>{c.name}</span>
                          <button className={styles.deleteBtn} onClick={() => handleDeleteChar(c.id)}>✕</button>
                        </div>
                      ))
                    : weapons.map(w => (
                        <div key={w.id} className={styles.item}>
                          {w.image_url && <img src={w.image_url} alt={w.name} className={styles.itemImg} />}
                          <span className={styles.itemName}>{w.name}</span>
                          <span className={styles.itemDanger}>
                            {'★'.repeat(w.danger_level)}{'☆'.repeat(5 - w.danger_level)}
                          </span>
                          <button className={styles.deleteBtn} onClick={() => handleDeleteWeapon(w.id)}>✕</button>
                        </div>
                      ))
                  }
                </div>
              </>
            )}
          </div>
        </div>
      </ArcadeFrame>

      {/* New Set Modal */}
      <Modal isOpen={showNewSet} onClose={() => setShowNewSet(false)} title={t('sets.newSetModal')}>
        <div className={styles.modalForm}>
          <ArcadeInput
            label={t('sets.setName')}
            placeholder={t('sets.setNamePlaceholder')}
            value={newSetName}
            onChange={e => setNewSetName(e.target.value)}
          />
          <ArcadeButton variant="yellow" loading={saving} onClick={handleCreateSet}>
            {t('sets.create')}
          </ArcadeButton>
        </div>
      </Modal>

      {/* New Item Modal */}
      <Modal
        isOpen={showNewItem}
        onClose={() => setShowNewItem(false)}
        title={tab === 'characters' ? t('sets.addCharModal') : t('sets.addWeapModal')}
      >
        <div className={styles.modalForm}>
          <ArcadeInput
            label={t('sets.itemName')}
            placeholder={t('sets.itemNamePlaceholder')}
            value={newItemName}
            onChange={e => setNewItemName(e.target.value)}
          />
          {tab === 'weapons' && (
            <div className={styles.dangerRow}>
              <label className={styles.fieldLabel}>{t('sets.danger', { n: newDanger })}</label>
              <input
                type="range" min={1} max={5} step={1} value={newDanger}
                onChange={e => setNewDanger(Number(e.target.value))}
                className={styles.slider}
              />
            </div>
          )}
          <div className={styles.fileRow}>
            <label className={styles.fieldLabel}>{t('sets.image')}</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setNewItemFile(e.target.files?.[0] ?? null)}
              className={styles.fileInput}
            />
          </div>
          <ArcadeButton variant="yellow" loading={saving} onClick={handleCreateItem}>
            {t('sets.addBtn')}
          </ArcadeButton>
        </div>
      </Modal>
    </div>
  )
}
