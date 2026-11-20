import { supabase } from './supabase.js'

export const messagePageSize = 50
export function validateMemberId(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '')) throw new Error('This member link is invalid.')
}
export function validateMessage(body) {
  const text = body.trim()
  if (!text || [...text].length > 2000) throw new Error('Enter a message between 1 and 2,000 characters.')
  return text
}
export function messagingError(error) {
  if (['PGRST200', 'PGRST201'].includes(error.code)) return 'Could not resolve the message reply relationship. Check the linked-reply query and database schema cache.'
  if (['42P01', 'PGRST205', 'PGRST202'].includes(error.code)) return 'Messaging needs setup. Apply 20261119_private_messages.sql, then retry.'
  if (error.code === '42703') return 'Review and apply the messaging migrations through 20261122_linked_replies.sql before using this version.'
  return 'Could not load messages. Check your connection and try again.'
}
export async function getMessageMember(id) {
  validateMemberId(id)
  const { data, error } = await supabase.from('profiles').select('id, display_name, avatar_path').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}
export async function getInbox(page = 0) {
  const { data, error } = await supabase.rpc('ralli_message_inbox', { page_offset: page * 20 })
  if (error) throw error
  return { people: data.slice(0, 20), hasMore: data.length > 20 }
}
export async function getMessages(viewerId, memberId, limit = messagePageSize) {
  validateMemberId(viewerId)
  validateMemberId(memberId)
  const { data, error } = await supabase.from('messages').select('id, sender_id, recipient_id, body, created_at, unsent_at, reply_to_message_id')
    .or(`and(sender_id.eq.${viewerId},recipient_id.eq.${memberId}),and(sender_id.eq.${memberId},recipient_id.eq.${viewerId})`)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1)
  if (error) throw error
  const messages = data.slice(0, limit).reverse()
  const ids = [...new Set(messages.map((message) => message.reply_to_message_id).filter(Boolean))]
  const originals = new Map()
  // Read exact originals through RLS, including originals outside the loaded page.
  // Small batches keep URLs manageable when older history is loaded.
  for (let offset = 0; offset < ids.length; offset += 50) {
    const result = await supabase.from('messages').select('id, sender_id, recipient_id, body, unsent_at')
      .in('id', ids.slice(offset, offset + 50))
    if (result.error) throw result.error
    for (const original of result.data) {
      if ((original.sender_id === viewerId && original.recipient_id === memberId)
        || (original.sender_id === memberId && original.recipient_id === viewerId)) {
        originals.set(original.id, original.unsent_at ? { ...original, body: null } : original)
      }
    }
  }
  return { messages: messages.map((message) => message.reply_to_message_id
    ? { ...message, reply: originals.get(message.reply_to_message_id) || null } : message), hasMore: data.length > limit }
}
export async function sendMessage(viewerId, memberId, body, id, replyTo = null) {
  validateMemberId(viewerId)
  validateMemberId(memberId)
  validateMemberId(id)
  if (viewerId === memberId) throw new Error('Choose another member to message.')
  if (replyTo !== null) validateMemberId(replyTo)
  const text = validateMessage(body)
  // The database assigns the sender from the real authenticated session.
  const { data, error } = await supabase.from('messages').insert({ id, recipient_id: memberId, body: text, ...(replyTo ? { reply_to_message_id: replyTo } : {}) })
    .select('id, sender_id, recipient_id, body, created_at, unsent_at, reply_to_message_id').single()
  if (!error) return data
  // A lost response may mean the first attempt already saved this message.
  if (error.code === '23505') {
    const saved = await supabase.from('messages').select('id, sender_id, recipient_id, body, created_at, unsent_at, reply_to_message_id').eq('id', id).maybeSingle()
    if (!saved.error && !saved.data) throw new Error('This send ID is no longer visible. It will not be sent again.')
    if (!saved.error && saved.data?.unsent_at && saved.data?.sender_id === viewerId && saved.data?.recipient_id === memberId) throw new Error('This message was already unsent. It will not be sent again.')
    if (!saved.error && saved.data?.sender_id === viewerId && saved.data?.recipient_id === memberId && saved.data?.body === text && (saved.data?.reply_to_message_id || null) === replyTo) return saved.data
  }
  throw error
}

export async function unsendMessage(id) {
  validateMemberId(id)
  const { data, error } = await supabase.rpc('ralli_unsend_message', { message_id: id })
  if (error) {
    if (error.code === 'PGRST202') throw new Error('Unsend needs the 20261120_unsend_messages.sql migration.')
    throw new Error('Could not confirm unsending. Please retry; repeating this action is safe.')
  }
  if (data?.id !== id || !data.unsent_at) throw new Error('Could not confirm unsending. Please retry.')
  return { id, unsent_at: data.unsent_at }
}

// An observed unsend is permanent, even if an older poll arrives afterward.
export function preserveUnsent(data, known) {
  if (!data?.messages) return data
  for (const message of data.messages) {
    if (message.unsent_at) known.set(message.id, message.unsent_at)
    if (message.reply?.unsent_at) known.set(message.reply.id, message.reply.unsent_at)
  }
  return { ...data, messages: data.messages.map((message) => ({
    ...message,
    ...(known.has(message.id) ? { body: null, unsent_at: known.get(message.id) } : {}),
    ...(message.reply && known.has(message.reply.id)
      ? { reply: { ...message.reply, body: null, unsent_at: known.get(message.reply.id) } } : {}),
  })) }
}

export async function hideMessage(id) {
  validateMemberId(id)
  const { data, error } = await supabase.rpc('ralli_hide_message', { message_id: id })
  if (error || data?.id !== id || data.hidden !== true) throw new Error('Could not confirm deletion. Check the visibility migration and retry safely.')
  return data
}
export async function hideConversation(otherId, requestId) {
  validateMemberId(otherId)
  validateMemberId(requestId)
  const { data, error } = await supabase.rpc('ralli_hide_conversation', { other_user_id: otherId, request_id: requestId })
  if (error || data?.other_user_id !== otherId || data?.request_id !== requestId || data.hidden !== true) throw new Error('Could not confirm conversation deletion. Retry this same request safely.')
  return data
}
export function filterHidden(data, ids) {
  if (!data?.messages) return data
  // Once a preview is unavailable, an older response must not restore its text.
  for (const message of data.messages) {
    if (message.reply_to_message_id && !message.reply) ids.add(message.reply_to_message_id)
  }
  return { ...data, messages: data.messages.filter((message) => !ids.has(message.id)).map((message) =>
    ids.has(message.reply_to_message_id) ? { ...message, reply: null } : message) }
}

export async function getMessageText(id) {
  validateMemberId(id)
  const { data, error } = await supabase.from('messages').select('body, unsent_at').eq('id', id).maybeSingle()
  if (error || !data || data.unsent_at || !data.body) throw new Error('This message is no longer available to copy, quote, or forward.')
  return data.body
}
