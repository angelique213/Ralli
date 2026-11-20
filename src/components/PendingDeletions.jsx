import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { listPending } from '../services/pendingDeletion.js'
import { deleteConversationSafely } from '../services/conversationDeletion.js'

export default function PendingDeletions({ userId, onResolved }) {
  const [records, setRecords] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const active = useRef(true)
  const pending = useRef(false)
  useEffect(() => {
    active.current = true
    function reload() {
      try { setRecords(listPending(window.localStorage, userId)); setError('') }
      catch { setError('Pending-deletion storage could not be read. Deletion is blocked if its metadata cannot be verified.') }
    }
    reload()
    window.addEventListener('storage', reload)
    window.addEventListener('ralli-pending-deletion', reload)
    return () => { active.current = false; window.removeEventListener('storage', reload); window.removeEventListener('ralli-pending-deletion', reload) }
  }, [userId])
  async function retry(record) {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      await deleteConversationSafely(userId, record.otherUserId, record.requestId)
      if (active.current) onResolved()
    } catch (problem) { if (active.current) setError(problem.message) }
    finally { pending.current = false; if (active.current) setBusy(false) }
  }
  if (!records.length && !error) return null
  return <section className="pending-deletions" aria-label="Pending conversation deletions">
    {records.length > 0 && <><h2>Pending conversation deletion</h2><p>If the earlier deletion completed, retrying preserves newer messages. If it never reached the server, retrying deletes the conversation’s currently visible history for you.</p></>}
    {records.map((record) => <div className="message-actions" key={record.requestId}><Link className="post-action" to={`/messages/${record.otherUserId}`}>View conversation</Link><button type="button" className="post-action" disabled={busy} onClick={() => retry(record)}>{busy ? 'Checking deletion…' : 'Retry pending deletion'}</button></div>)}
    {error && <p role="alert" className="field-error">{error}</p>}
  </section>
}
