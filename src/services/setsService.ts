import { supabase } from '../lib/supabase'
import type { CharacterSet, Character, WeaponSet, Weapon } from '../types/game'

// --- Character Sets ---
export async function getCharacterSets(): Promise<CharacterSet[]> {
  const { data, error } = await supabase.from('character_sets').select().order('name')
  if (error) throw error
  return (data as CharacterSet[]) ?? []
}

export async function createCharacterSet(name: string): Promise<CharacterSet> {
  const { data, error } = await supabase.from('character_sets').insert({ name }).select().single()
  if (error) throw error
  return data as CharacterSet
}

export async function deleteCharacterSet(id: string): Promise<void> {
  const { error } = await supabase.from('character_sets').delete().eq('id', id)
  if (error) throw error
}

// --- Characters ---
export async function getCharactersForSet(setId: string): Promise<Character[]> {
  const { data, error } = await supabase
    .from('characters').select().eq('set_id', setId).order('name')
  if (error) throw error
  return (data as Character[]) ?? []
}

export async function createCharacter(
  setId: string, name: string, imageUrl?: string | null
): Promise<Character> {
  const { data, error } = await supabase
    .from('characters').insert({ set_id: setId, name, image_url: imageUrl ?? null }).select().single()
  if (error) throw error
  return data as Character
}

export async function updateCharacterImage(id: string, imageUrl: string): Promise<void> {
  const { error } = await supabase.from('characters').update({ image_url: imageUrl }).eq('id', id)
  if (error) throw error
}

export async function deleteCharacter(id: string): Promise<void> {
  const { error } = await supabase.from('characters').delete().eq('id', id)
  if (error) throw error
}

// --- Weapon Sets ---
export async function getWeaponSets(): Promise<WeaponSet[]> {
  const { data, error } = await supabase.from('weapon_sets').select().order('name')
  if (error) throw error
  return (data as WeaponSet[]) ?? []
}

export async function createWeaponSet(name: string): Promise<WeaponSet> {
  const { data, error } = await supabase.from('weapon_sets').insert({ name }).select().single()
  if (error) throw error
  return data as WeaponSet
}

export async function deleteWeaponSet(id: string): Promise<void> {
  const { error } = await supabase.from('weapon_sets').delete().eq('id', id)
  if (error) throw error
}

// --- Weapons ---
export async function getWeaponsForSet(setId: string): Promise<Weapon[]> {
  const { data, error } = await supabase
    .from('weapons').select().eq('set_id', setId).order('danger_level')
  if (error) throw error
  return (data as Weapon[]) ?? []
}

export async function createWeapon(
  setId: string, name: string, dangerLevel: number, imageUrl?: string | null
): Promise<Weapon> {
  const { data, error } = await supabase
    .from('weapons')
    .insert({ set_id: setId, name, danger_level: dangerLevel, image_url: imageUrl ?? null })
    .select().single()
  if (error) throw error
  return data as Weapon
}

export async function deleteWeapon(id: string): Promise<void> {
  const { error } = await supabase.from('weapons').delete().eq('id', id)
  if (error) throw error
}

export async function getAllWeapons(): Promise<Weapon[]> {
  const { data, error } = await supabase
    .from('weapons').select().order('danger_level')
  if (error) throw error
  return (data as Weapon[]) ?? []
}

export async function getWeaponsForLobby(weaponSetId: string | null): Promise<Weapon[]> {
  if (!weaponSetId) return getAllWeapons()
  return getWeaponsForSet(weaponSetId)
}
