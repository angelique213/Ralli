import { supabase } from './supabase.js'

export const categories = ['Fitness', 'Learning', 'Wellness', 'Creativity', 'Personal Growth', 'Other']
const fields = 'id, creator_id, title, description, category, duration_days, daily_goal, created_at, updated_at, creator:profiles!challenges_creator_id_fkey(id, display_name, avatar_path)'
const pageSize = 12

export function challengeError(error) {
  if (['42P01', 'PGRST200', 'PGRST205', '42703'].includes(error.code)) return 'Challenges need database setup. Apply 20261106_challenges.sql in Supabase SQL Editor, then retry.'
  return error.message || 'Could not reach Supabase. Please try again.'
}

export function validateChallenge(values) {
  const clean = { title: values.title.trim(), description: values.description.trim(), category: values.category, daily_goal: values.daily_goal.trim(), duration_days: Number(values.duration_days) }
  for (const [field, label, limit] of [['title', 'Title', 100], ['description', 'Description', 500], ['daily_goal', 'Daily goal', 300]]) {
    if (!clean[field] || clean[field].length > limit) throw new Error(`${label} must contain 1–${limit} characters.`)
  }
  if (!categories.includes(clean.category)) throw new Error('Choose a challenge category.')
  if (!Number.isInteger(clean.duration_days) || clean.duration_days < 1 || clean.duration_days > 365) throw new Error('Duration must be a whole number between 1 and 365.')
  return clean
}

export async function getChallengeActivity(id, userId) {
  const [count, membership] = await Promise.all([
    supabase.from('challenge_participants').select('id', { count: 'exact', head: true }).eq('challenge_id', id),
    supabase.from('challenge_participants').select('id').eq('challenge_id', id).eq('user_id', userId).maybeSingle(),
  ])
  for (const result of [count, membership]) if (result.error) throw result.error
  // Read in small batches so all 365 possible days are counted.
  const days = []
  for (let start = 0; ; start += 100) {
    const { data, error } = await supabase.from('challenge_progress').select('day_number').eq('challenge_id', id).eq('user_id', userId).order('day_number').range(start, start + 99)
    if (error) throw error
    days.push(...data.map((day) => day.day_number))
    if (data.length < 100) break
  }
  return { participantCount: count.count, joined: Boolean(membership.data), days }
}

export async function listChallenges(userId, search, tab, page) {
  const memberJoin = tab === 'joined' ? ', membership:challenge_participants!inner(user_id)' : ''
  let query = supabase.from('challenges').select(fields + memberJoin)
  if (tab === 'joined') query = query.eq('membership.user_id', userId)
  if (tab === 'created') query = query.eq('creator_id', userId)
  const term = search.trim().replace(/[\\%_]/g, '\\$&')
  const { data, error } = await query.ilike('title', `%${term}%`).order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * pageSize, (page + 1) * pageSize)
  if (error) throw error
  const challenges = await Promise.all(data.slice(0, pageSize).map(async (challenge) => ({ ...challenge, activity: await getChallengeActivity(challenge.id, userId) })))
  return { challenges, hasMore: data.length > pageSize }
}

export async function getChallenge(id, userId) {
  const { data, error } = await supabase.from('challenges').select(fields).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? { ...data, activity: await getChallengeActivity(id, userId) } : null
}

export async function saveChallenge(values, userId, id) {
  const clean = validateChallenge(values)
  // New challenges and creator participation are saved by one database transaction.
  let query
  if (id) {
    // Duration and ownership never change during an edit.
    const { title, description, category, daily_goal } = clean
    query = supabase.from('challenges').update({ title, description, category, daily_goal }).eq('id', id).eq('creator_id', userId)
  } else query = supabase.from('challenges').insert({ ...clean, creator_id: userId })
  const { data, error } = await query.select(fields).single()
  if (error) throw error
  return data
}

export async function setParticipation(id, userId, joined) {
  const query = joined
    ? supabase.from('challenge_participants').insert({ challenge_id: id, user_id: userId })
    : supabase.from('challenge_participants').delete().eq('challenge_id', id).eq('user_id', userId)
  const { error } = await query
  if (error && error.code !== '23505') throw error
}

export async function setDayComplete(id, userId, day, complete) {
  const query = complete
    ? supabase.from('challenge_progress').insert({ challenge_id: id, user_id: userId, day_number: day })
    : supabase.from('challenge_progress').delete().eq('challenge_id', id).eq('user_id', userId).eq('day_number', day)
  const { error } = await query
  if (error && error.code !== '23505') throw error
}
