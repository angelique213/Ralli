import { supabase } from './supabase.js'
import { validateProfileImage } from './profile.js'

export const postImageBucket = 'ralli-post-images'
const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

// Posts use the same 5 MB limit and readable-image checks as profile photos.
export const validatePostImage = validateProfileImage

export function newPostImagePath(userId, file) {
  return `${userId}/${crypto.randomUUID()}.${extensions[file.type]}`
}

export function postImageUrl(path) {
  return supabase.storage.from(postImageBucket).getPublicUrl(path).data.publicUrl
}

export async function removeUnusedPostImage(path) {
  try {
    const { data, error } = await supabase.storage.from(postImageBucket).remove([path])
    return !error && data?.some((object) => object.name === path)
  } catch { return false }
}

export async function cleanDeletedPostImage(path, userId) {
  if (!path) return true
  // Use only the path returned by the deleted database row, in this user's folder.
  const [owner, filename, extra] = path.split('/')
  if (!userId || owner !== userId || extra !== undefined || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(filename || '')) {
    throw new Error('Photo cleanup was blocked because the saved path does not belong to this account.')
  }
  if (await removeUnusedPostImage(path)) return true
  // A retry may find that the first request already removed the file.
  try {
    const account = await supabase.auth.getUser()
    if (!account.error && account.data.user?.id === userId) {
      const listed = await supabase.storage.from(postImageBucket).list(userId, { search: filename, limit: 2 })
      if (!listed.error && listed.data && !listed.data.some((object) => object.name === filename)) return true
    }
  } catch { /* Keep the warning when cleanup cannot be verified. */ }
  throw new Error('The post was deleted, but photo removal could not be confirmed. Retry cleanup, or check the unused image in Supabase Storage.')
}
