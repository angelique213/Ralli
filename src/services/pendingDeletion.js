// Only IDs and creation time are persisted. Never put message content here.
export const pendingDeletionPrefix = 'ralli:pending-conversation-delete:'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function keyFor(userId, otherUserId) {
  if (!uuid.test(userId || '') || !uuid.test(otherUserId || '') || userId === otherUserId) throw new Error('Please sign in again and reopen the conversation.')
  return `${pendingDeletionPrefix}${userId}:${otherUserId}`
}
export function readPending(storage, userId, otherUserId) {
  const raw = storage.getItem(keyFor(userId, otherUserId))
  if (raw === null) return null
  let record
  try { record = JSON.parse(raw) } catch { throw new Error('Pending deletion metadata is unreadable. Deletion is blocked; do not clear browser storage to retry.') }
  if (record?.userId !== userId || record?.otherUserId !== otherUserId || !uuid.test(record?.requestId || '') || !Number.isFinite(Date.parse(record?.createdAt)) || Object.keys(record).sort().join() !== 'createdAt,otherUserId,requestId,userId') throw new Error('Pending deletion metadata is invalid. Deletion is blocked for safety.')
  return record
}
export function listPending(storage, userId) {
  const prefix = `${pendingDeletionPrefix}${userId}:`
  const records = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key?.startsWith(prefix)) records.push(readPending(storage, userId, key.slice(prefix.length)))
  }
  return records.filter(Boolean)
}

export async function recoverableDelete({ storage, locks, userId, otherUserId, expectedRequestId, createId, send, verifyUser, changed = () => {} }) {
  const key = keyFor(userId, otherUserId)
  if (!locks?.request) throw new Error('Safe deletion requires browser Web Locks. Use a current browser on HTTPS or localhost.')
  // Do not queue clicks: a queued click could become a new deletion after cleanup.
  return locks.request(key, { ifAvailable: true }, async (lock) => {
    if (!lock) throw new Error('Deletion is already running in another tab. Wait, then retry the pending operation.')
    if (await verifyUser() !== userId) throw new Error('Your account changed. Reopen Messages before retrying.')
    let record = readPending(storage, userId, otherUserId)
    if (expectedRequestId && record?.requestId !== expectedRequestId) throw new Error('This pending operation changed or was resolved in another tab. Refresh Messages.')
    if (!record) {
      record = { userId, otherUserId, requestId: createId(), createdAt: new Date().toISOString() }
      if (!uuid.test(record.requestId)) throw new Error('Could not create a safe request ID.')
      storage.setItem(key, JSON.stringify(record))
      // Verify persistence before allowing the network request.
      if (readPending(storage, userId, otherUserId)?.requestId !== record.requestId) throw new Error('Could not save pending deletion. Nothing was sent.')
      changed()
    }
    const result = await send(otherUserId, record.requestId)
    if (result?.hidden !== true || result.request_id !== record.requestId || result.other_user_id !== otherUserId) throw new Error('Deletion was not confirmed. Keep this pending request and retry.')
    if (readPending(storage, userId, otherUserId)?.requestId !== record.requestId) throw new Error('Deletion confirmed, but recovery metadata changed. Refresh Messages.')
    // If removal fails, keep the record; replaying the confirmed UUID is harmless.
    storage.removeItem(key)
    changed()
    return result
  })
}
