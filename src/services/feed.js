import { supabase } from './supabase.js'

function database() {
  if (!supabase) throw new Error('Supabase is not configured. Check your local .env file.')
  return supabase
}

export function feedError(error) {
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
const postFields = 'id, user_id, body, created_at, profiles!posts_user_id_fkey(display_name)'
const commentFields = 'id, user_id, body, created_at, profiles!comments_user_id_fkey(display_name)'

export function getPosts() {
  return readAll(() => database().from('posts').select(postFields).order('created_at', { ascending: false }).order('id', { ascending: false }))
}

export async function createPost(body, userId) {
  const { data, error } = await database().from('posts').insert({ body, user_id: userId }).select(postFields).single()
  if (error) throw error
  return data
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
