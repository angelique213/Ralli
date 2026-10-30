import { supabase } from './supabase.js'

const bucket = 'ralli-profile-images'
const types = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export function profileImageUrl(path) {
  return path ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : ''
}

export function validateProfile(name, bio) {
  if (!name.trim() || name.trim().length > 100) throw new Error('Enter a display name between 1 and 100 characters.')
  if (bio.trim().length > 300) throw new Error('Keep your bio to 300 characters or fewer.')
}

export async function validateProfileImage(file) {
  if (!types[file.type]) throw new Error('Choose a JPEG, PNG, or WebP image.')
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('Choose an image smaller than or equal to 5 MB.')
  // Checks that the selected file can actually be opened as an image.
  let bitmap
  try { bitmap = await createImageBitmap(file) } catch { throw new Error('This image could not be opened. Choose another image.') }
  bitmap.close()
}

async function updateProfile(userId, changes) {
  if (!userId) throw new Error('Please log in again.')
  const { data, error } = await supabase.from('profiles').update(changes).eq('id', userId).select('*').single()
  if (error) throw error
  return data
}

export function saveProfile(userId, name, bio) {
  validateProfile(name, bio)
  return updateProfile(userId, { display_name: name.trim(), bio: bio.trim() })
}

export async function uploadProfileImage(userId, kind, file) {
  if (!userId || !['avatar', 'cover'].includes(kind)) throw new Error('Please reopen your profile and try again.')
  await validateProfileImage(file)
  // Unique names keep a failed replacement from overwriting the current photo.
  const path = `${userId}/${kind}/${crypto.randomUUID()}.${types[file.type]}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type })
  if (error) throw error
  // Only report success after the profile points to the uploaded file.
  // If this request fails, keep the object: the server may have saved the row
  // even when its response was lost. Refresh before retrying.
  return updateProfile(userId, { [`${kind}_path`]: path })
}
