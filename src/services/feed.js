import { supabase } from './supabase.js'
import { newPostImagePath, postImageBucket, removeUnusedPostImage, validatePostImage } from './postImages.js'

function database() {
  if (!supabase) throw new Error('Supabase is not configured. Check your local .env file.')
  return supabase
}

export function feedError(error) {
  if (['42703', 'PGRST204'].includes(error.code)) return 'Post images need database setup. Apply 20261113_post_images.sql in Supabase SQL Editor, then refresh.'
  if (['42P01', 'PGRST200', 'PGRST205'].includes(error.code)) {
    return 'The feed tables are not ready. Apply the Ralli SQL migration in Supabase SQL Editor, then retry.'
  }
  return error.message || 'Could not reach the database. Please try again.'
}

// Reads in batches so Supabase's row limit does not hide older records.
async function readAll(makeQuery) {
  const rows = []
  for (let start = 0; ; start += 100) {
    const { data, error } = await makeQuery().range(start, start + 99)
    if (error) throw error
    rows.push(...data)
    if (data.length < 100) return rows
  }
}

// Uses the author's foreign key, not the relationship through likes.
const postFields = 'id, user_id, body, image_path, created_at, profiles!posts_user_id_fkey(display_name, avatar_path)'
const commentFields = 'id, user_id, body, created_at, profiles!comments_user_id_fkey(display_name, avatar_path)'

export function getPosts() {
  return readAll(() => database().from('posts').select(postFields).order('created_at', { ascending: false }).order('id', { ascending: false }))
}

// Only explicit database rejections are safe to clean up automatically.
function definitelyRejected(error) {
  return /^(22|23)/.test(error.code || '') || ['42501', '42703', 'PGRST204'].includes(error.code)
}

export async function createPost(body, userId, image = null, onStatus = () => {}) {
  body = body.trim()
  if (!userId) throw new Error('Please log in before posting.')
  if ((!body && !image) || body.length > 5000) throw new Error('Add text or a photo, and keep text to 5000 characters or fewer.')
  let imagePath = null
  if (image) {
    await validatePostImage(image)
    imagePath = newPostImagePath(userId, image)
    onStatus('Uploading photo…')
    let uploadError
    try {
      const result = await database().storage.from(postImageBucket).upload(imagePath, image, { upsert: false, contentType: image.type })
      uploadError = result.error
    } catch (problem) { uploadError = problem }
    if (uploadError) {
      // No post request was sent, so this attempt's unique upload can be removed.
      const removed = await removeUnusedPostImage(imagePath)
      throw new Error(`Photo upload failed: ${uploadError.message || 'Check your connection.'}${removed ? '' : ' If a file reached Storage, its cleanup could not be confirmed.'}`)
    }
  }
  onStatus('Publishing post…')
  let result
  try {
    result = await database().from('posts').insert({ body, user_id: userId, image_path: imagePath }).select(postFields).single()
  } catch (error) { result = { error } }
  if (!result.error && result.data) return result.data
  const problem = result.error || new Error('The database did not return the saved post.')
  if (imagePath) {
    // A lost response may still mean the post saved. Recover it before cleanup.
    try {
      const saved = await database().from('posts').select(postFields).eq('user_id', userId).eq('image_path', imagePath).maybeSingle()
      if (!saved.error && saved.data) return saved.data
    } catch { /* Leave uncertain uploads intact to protect saved posts. */ }
    if (definitelyRejected(problem)) {
      const removed = await removeUnusedPostImage(imagePath)
      throw new Error(`${feedError(problem)} ${removed ? 'The unused photo was removed.' : 'The unused photo could not be cleaned up; check Storage before retrying.'}`)
    }
  }
  if (definitelyRejected(problem)) throw problem
  const uncertain = new Error('The save result could not be confirmed. Refresh and check the feed before posting again. Any uploaded photo was kept to protect a possibly saved post.')
  uncertain.uncertain = true
  throw uncertain
}

export function getComments(postId) {
  return readAll(() => database().from('comments').select(commentFields).eq('post_id', postId).order('created_at').order('id'))
}

export async function createComment(postId, body, userId) {
  const { data, error } = await database().from('comments').insert({ post_id: postId, body, user_id: userId }).select(commentFields).single()
  if (error) throw error
  return data
}

export async function getActivity(postId, userId) {
  const db = database()
  const requests = [
    db.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
    db.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', postId),
    userId ? db.from('likes').select('user_id').eq('post_id', postId).eq('user_id', userId).maybeSingle() : Promise.resolve({ data: null }),
  ]
  const [likes, comments, ownLike] = await Promise.all(requests)
  for (const result of [likes, comments, ownLike]) if (result.error) throw result.error
  return { likeCount: likes.count, commentCount: comments.count, isLiked: Boolean(ownLike.data) }
}

export async function saveLike(postId, userId, isLiked) {
  const query = isLiked
    ? database().from('likes').delete().eq('post_id', postId).eq('user_id', userId)
    : database().from('likes').insert({ post_id: postId, user_id: userId })
  const { error } = await query
  // Another tab may already have added this user's like.
  if (error && error.code !== '23505') throw error
}

// Loads only the signed-in user's posts, newest first.
export function getUserPosts(userId) {
  if (!userId) throw new Error('Please log in to view your posts.')
  return readAll(() => database().from('posts').select(postFields).eq('user_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false }))
}

export async function getProfile(userId) {
  if (!userId) throw new Error('Please log in to view your profile.')
  const { data, error } = await database().from('profiles').select('id, display_name, bio, avatar_path, cover_path, created_at').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

export async function deletePost(postId, userId) {
  if (!postId || !userId) throw new Error('Please log in before deleting a post.')
  // RLS checks the real authenticated account; this filter is extra protection.
  const { data, error } = await database().from('posts').delete()
    .eq('id', postId).eq('user_id', userId).select('id, user_id, image_path').maybeSingle()
  if (error) throw new Error(`Could not confirm deletion: ${feedError(error)} Refresh before retrying. The photo was not removed.`)
  if (!data) throw new Error('This post is no longer available or you cannot delete it. Refresh the page to check.')
  return data
}
