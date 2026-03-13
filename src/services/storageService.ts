import { supabase } from '../lib/supabase'
import { PLAYER_BUCKETS } from '../lib/constants'

export async function uploadPlayerPhoto(file: File, playerId: string): Promise<string> {
  const ext  = file.name.split('.').pop()
  const path = `${playerId}.${ext}`

  const { error } = await supabase.storage
    .from(PLAYER_BUCKETS.PHOTOS)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw error

  const { data } = supabase.storage
    .from(PLAYER_BUCKETS.PHOTOS)
    .getPublicUrl(path)

  return data.publicUrl
}

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '_')
}

export async function uploadSetImage(file: File, name: string): Promise<string> {
  const ext  = file.name.split('.').pop()
  const path = `${Date.now()}-${slugify(name)}.${ext}`

  const { error } = await supabase.storage
    .from(PLAYER_BUCKETS.SET_IMAGES)
    .upload(path, file, { upsert: false, contentType: file.type })

  if (error) throw error

  const { data } = supabase.storage
    .from(PLAYER_BUCKETS.SET_IMAGES)
    .getPublicUrl(path)

  return data.publicUrl
}

export async function deleteStorageFile(bucket: string, path: string): Promise<void> {
  await supabase.storage.from(bucket).remove([path])
}
