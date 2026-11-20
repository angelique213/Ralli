import { useEffect, useId, useRef, useState } from 'react'
import Avatar from './Avatar.jsx'
import { searchPeople } from '../services/connections.js'
import { getMessageText, sendMessage } from '../services/messages.js'

export default function ForwardMessage({ message, userId, onClose, onSent }) {
  const dialog = useRef(null)
  const searchInput = useRef(null)
  const active = useRef(true)
  const pending = useRef(false)
  const request = useRef(0)
  const attempt = useRef(null)
  const [search, setSearch] = useState('')
  const [people, setPeople] = useState([])
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [finding, setFinding] = useState(false)
  const [searched, setSearched] = useState(false)
  const title = useId()
  useEffect(() => {
    active.current = true
    dialog.current.showModal()
    searchInput.current.focus()
    return () => { active.current = false }
  }, [])
  async function find(event) {
    event.preventDefault()
    const version = ++request.current
    setFinding(true); setError(''); setSearched(true)
    try {
      const result = await searchPeople(userId, search)
      if (active.current && version === request.current) setPeople(result.people)
    } catch { if (active.current && version === request.current) setError('Could not search members. Try again.') }
    finally { if (active.current && version === request.current) setFinding(false) }
  }
  async function forward() {
    if (!selected || pending.current) return
    pending.current = true; setBusy(true); setError('')
    if (!attempt.current) attempt.current = crypto.randomUUID()
    try {
      // Recheck access and unsent state before making a separate copy.
      const body = await getMessageText(message.id)
      if (body !== message.body) throw new Error('This message changed. Close this dialog and try again.')
      await sendMessage(userId, selected.id, body, attempt.current)
      if (active.current) { onSent(); onClose() }
    } catch (problem) { if (active.current) setError(problem.message || 'Could not confirm forwarding. Retry with the same recipient.') }
    finally { pending.current = false; if (active.current) setBusy(false) }
  }
  return <dialog ref={dialog} className="post-delete-dialog message-forward-dialog" aria-labelledby={title} onCancel={(event) => { event.preventDefault(); if (!pending.current) onClose() }}>
    <h2 id={title}>Forward message</h2>
    <p>This sends a separate text copy from you. Unsending the original will not remove the copy.</p>
    <form onSubmit={find} className="message-search"><label htmlFor={`${title}-search`}>Find a recipient</label><input ref={searchInput} id={`${title}-search`} value={search} maxLength={100} disabled={busy} onChange={(event) => setSearch(event.target.value)} /><button className="post-action" disabled={busy || finding}>Search</button></form>
    {finding && <p role="status">Searching…</p>}
    <div className="forward-people">{people.map((person) => <button type="button" className="forward-person" key={person.id} disabled={busy} aria-pressed={selected?.id === person.id} onClick={() => { if (selected?.id !== person.id) attempt.current = null; setSelected(person); setError('') }}><Avatar profile={person} small /><span>{person.display_name}</span></button>)}</div>
    {searched && !finding && !people.length && <p>No matches. Try another name.</p>}
    {people.length === 20 && <p>Showing the first 20 matches. Refine your search if needed.</p>}
    {selected && <p>Send to <strong>{selected.display_name}</strong></p>}
    {error && <p role="alert" className="field-error">{error}</p>}
    <div className="post-delete-actions"><button className="post-action" disabled={busy} onClick={onClose}>Cancel</button><button className="primary-button" disabled={!selected || busy} onClick={forward}>{busy ? 'Forwarding…' : 'Forward'}</button></div>
  </dialog>
}
