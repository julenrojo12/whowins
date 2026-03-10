import en from './en.json'
import es from './es.json'
import { useGameStore } from '../store'

type Translations = typeof en
type Key = keyof Translations

const translations: Record<string, Translations> = { en, es }

function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    str
  )
}

export function useT() {
  const lang = useGameStore(s => s.lang)
  const dict = translations[lang] ?? en

  return function t(key: Key, params?: Record<string, string | number>): string {
    const str = dict[key] ?? en[key] ?? key
    return interpolate(str, params)
  }
}
