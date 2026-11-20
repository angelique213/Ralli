import { supabase } from './supabase.js'
import { hideConversation } from './messages.js'
import { recoverableDelete } from './pendingDeletion.js'

export function deleteConversationSafely(userId, otherUserId, expectedRequestId) {
  return recoverableDelete({
    storage: window.localStorage,
    locks: navigator.locks,
    userId, otherUserId, expectedRequestId,
    createId: () => crypto.randomUUID(),
    send: hideConversation,
    verifyUser: async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) throw new Error('Could not verify your account. Please sign in again.')
      return data.user?.id
    },
    changed: () => window.dispatchEvent(new Event('ralli-pending-deletion')),
  })
}
