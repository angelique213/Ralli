import { supabase } from './supabase.js'

export const publicProfileFields = 'id, display_name, bio, avatar_path, cover_path, created_at'
export const peoplePageSize = 20

export function connectionError(error) {
  if (['42P01', 'PGRST200', 'PGRST205'].includes(error.code)) return 'Connections need database setup. Apply 20261030_connections.sql in Supabase SQL Editor, then retry.'
  return error.message || 'Could not load connections. Please try again.'
}

export async function searchPeople(userId, search, page = 0) {
  // Escape LIKE wildcards so names containing % or _ can be searched literally.
  const term = search.trim().replace(/[\\%_]/g, '\\$&')
  const { data, error } = await supabase.from('profiles').select(publicProfileFields)
    .neq('id', userId).ilike('display_name', `%${term}%`)
    .order('display_name').order('id').range(page * peoplePageSize, (page + 1) * peoplePageSize)
  if (error) throw error
  return { people: data.slice(0, peoplePageSize), hasMore: data.length > peoplePageSize }
}

export async function isConnected(viewerId, targetId) {
  const { data, error } = await supabase.from('connections').select('id').eq('follower_id', viewerId).eq('following_id', targetId).maybeSingle()
  if (error) throw error
  return Boolean(data)
}

export async function saveConnection(viewerId, targetId, connected) {
  if (!viewerId || viewerId === targetId) throw new Error('You cannot connect to yourself.')
  const query = connected
    ? supabase.from('connections').delete().eq('follower_id', viewerId).eq('following_id', targetId)
    : supabase.from('connections').insert({ follower_id: viewerId, following_id: targetId })
  const { error } = await query
  // A second tab may already have created the same connection.
  if (error && error.code !== '23505') throw error
}

export async function getConnectionCounts(userId) {
  const results = await Promise.all(['follower_id', 'following_id'].map((field) =>
    supabase.from('connections').select('id', { count: 'exact', head: true }).eq(field, userId)))
  for (const result of results) if (result.error) throw result.error
  return { connections: results[0].count, connectedBy: results[1].count }
}

export async function getConnectionPeople(userId, direction, page = 0) {
  const outgoing = direction === 'connections'
  const foreignKey = outgoing ? 'connections_following_id_fkey' : 'connections_follower_id_fkey'
  const { data, error } = await supabase.from('connections')
    .select(`id, person:profiles!${foreignKey}(${publicProfileFields})`)
    .eq(outgoing ? 'follower_id' : 'following_id', userId)
    .order('created_at', { ascending: false }).order('id')
    .range(page * peoplePageSize, (page + 1) * peoplePageSize)
  if (error) throw error
  return { people: data.slice(0, peoplePageSize).map((row) => row.person).filter(Boolean), hasMore: data.length > peoplePageSize }
}

export function profilePath(authorId, viewerId) {
  return authorId === viewerId ? '/profile' : `/profile/${authorId}`
}
