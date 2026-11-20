import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router'
import MessageActions from '../components/MessageActions.jsx'
import ReplyPreview from '../components/ReplyPreview.jsx'
import PendingDeletions from '../components/PendingDeletions.jsx'
import Avatar from '../components/Avatar.jsx'
import { searchPeople } from '../services/connections.js'
import { getInbox, getMessageMember, getMessages, sendMessage, messagingError, messagePageSize, preserveUnsent, filterHidden } from '../services/messages.js'

// Poll only while visible. Cleanup prevents old requests updating another conversation.
function useMessagePolling(load) {
  const [state, setState] = useState({ data: null, error: '', loading: true })
  const [retry, setRetry] = useState(0)
  const knownUnsent = useRef(new Map())
  const hiddenIds = useRef(new Set())
  useEffect(() => {
    let active = true
    let running = false
    async function refresh() {
      if (document.hidden || running) return
      running = true
      try {
        const data = await load()
        if (active) setState({ data: filterHidden(preserveUnsent(data, knownUnsent.current), hiddenIds.current), error: '', loading: false })
      } catch (error) {
        if (active) setState((current) => ({ ...current, error: messagingError(error), loading: false }))
      } finally { running = false }
    }
    refresh()
    const timer = setInterval(refresh, 5000)
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [load, retry])
  function confirmUnsent(message) {
    knownUnsent.current.set(message.id, message.unsent_at)
    setState((current) => ({ ...current, data: preserveUnsent(current.data, knownUnsent.current) }))
    setRetry((value) => value + 1)
  }
  function confirmHidden(message) {
    hiddenIds.current.add(message.id)
    setState((current) => ({ ...current, data: filterHidden(current.data, hiddenIds.current) }))
    setRetry((value) => value + 1)
  }
  return { ...state, confirmHidden, confirmUnsent, retry: () => setRetry((value) => value + 1) }
}

function MemberLink({ person }) {
  const { userId } = useParams()
  const id = person.id || person.user_id
  const selected = userId?.toLowerCase() === id
  return <Link className={`message-member message-row ${selected ? 'message-selected' : ''}`} aria-current={selected ? 'page' : undefined} to={`/messages/${id}`}>
    <Avatar profile={person} small />
    <span className="message-row-copy"><strong>{person.display_name || 'Ralli Member'}</strong>
      <small>{person.last_sent_at ? <>Last message · <time dateTime={person.last_sent_at}>{new Date(person.last_sent_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></> : 'Start a conversation'}</small>
    </span>
  </Link>
}

function PeopleSearch({ user }) {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState(null)
  const [page, setPage] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (query === null) return
    let active = true
    searchPeople(user.id, query, page).then((data) => { if (active) setResult(data) })
      .catch(() => { if (active) setError('Could not find members. Try again.') })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [user.id, query, page, retry])
  function search(event) { event.preventDefault(); setBusy(true); setError(''); setPage(0); setQuery(input.trim()); setRetry((value) => value + 1) }
  return <section className="message-search-section"><form onSubmit={search} className="message-search"><label htmlFor="message-search">Search members by name</label><input id="message-search" maxLength={100} value={input} onChange={(e) => setInput(e.target.value)} type="search" placeholder="Search people by name..." /><button className="post-action">Search</button></form>
    {busy ? <p role="status">Searching…</p> : error ? <p role="alert">{error} Use Search to retry.</p> : result && <><div>{result.people.map((person) => <MemberLink key={person.id} person={person} />)}</div>{!result.people.length && <p>No members found.</p>}{(page > 0 || result.hasMore) && <div className="message-actions"><button disabled={!page} onClick={() => { setBusy(true); setPage(page - 1) }}>Previous</button><button disabled={!result.hasMore} onClick={() => { setBusy(true); setPage(page + 1) }}>Next</button></div>}</>}
  </section>
}
function Inbox() {
  const [page, setPage] = useState(0)
  const load = useCallback(() => getInbox(page), [page])
  const state = useMessagePolling(load)
  return <><h2>Conversations</h2>{state.loading && <p role="status">Loading conversations…</p>}{state.error && <p role="alert">{state.error} <button onClick={state.retry}>Retry</button></p>}
    {state.data?.people.map((person) => <MemberLink key={person.user_id} person={person} />)}
    {state.data && !state.data.people.length && <p>No conversations on this page. Search for a member to start one.</p>}{(page > 0 || state.data?.hasMore) && <div className="message-actions"><button disabled={!page} onClick={() => setPage(page - 1)}>Previous page</button><button disabled={!state.data?.hasMore} onClick={() => setPage(page + 1)}>Next page</button></div>}</>
}
function Conversation({ user, memberId, onConversationDeleted, onMessageDeleted }) {
  const [limit, setLimit] = useState(messagePageSize)
  const [draft, setDraft] = useState('')
  const [replyId, setReplyId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sendError, setSendError] = useState('')
  const [notice, setNotice] = useState('')
  const attempt = useRef(null)
  const sending = useRef(false)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const load = useCallback(async () => {
    if (memberId === user.id) throw new Error('self')
    const member = await getMessageMember(memberId)
    if (!member) return { member: null, messages: [], hasMore: false }
    return { member, ...await getMessages(user.id, memberId, limit) }
  }, [user.id, memberId, limit])
  const state = useMessagePolling(load)
  const replyTarget = state.data?.messages.find((message) => message.id === replyId)
  function showOriginal(id) {
    const original = document.getElementById(`message-${id}`)
    if (original) { original.scrollIntoView({ block: 'center', behavior: 'smooth' }); original.focus() }
    else setNotice('Use Load older messages to find the original message in your history.')
  }
  async function send(event) {
    event.preventDefault()
    if (sending.current) return
    sending.current = true
    setBusy(true); setSendError(''); setNotice('')
    if (!attempt.current) attempt.current = crypto.randomUUID()
    try {
      await sendMessage(user.id, memberId, draft, attempt.current, replyId)
      if (active.current) { setDraft(''); setReplyId(null); attempt.current = null; setNotice('Message sent.'); state.retry() }
    } catch (problem) {
      if (active.current) setSendError(['This message was already unsent. It will not be sent again.', 'This send ID is no longer visible. It will not be sent again.'].includes(problem.message) ? problem.message : 'Could not confirm delivery. Retry Send with the same text to safely check or complete this send.')
    } finally { sending.current = false; if (active.current) setBusy(false) }
  }
  if (memberId === user.id) return <p>Choose another member to start a conversation.</p>
  if (state.loading) return <p role="status">Loading conversation…</p>
  return <section className="message-thread">
    {state.error && <p role="alert">{state.error} <button onClick={state.retry}>Retry</button></p>}
    {state.data && !state.data.member && <p>Member not found. Choose another member.</p>}
    {state.data?.member && <><header className="message-chat-header"><Link to="/messages" className="message-mobile-back" aria-label="Back to Messages"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m15 18-6-6 6-6" /></svg></Link><Link className="message-member" to={`/profile/${memberId}`}><Avatar profile={state.data.member} small /><div><h2>{state.data.member.display_name}</h2><small>Private conversation</small></div></Link><MessageActions userId={user.id} memberId={memberId} onDeleted={onConversationDeleted} /></header>
      {state.data.hasMore && <button className="post-action" onClick={() => setLimit((value) => value + messagePageSize)}>Load older messages</button>}
      <ol className="message-history" aria-label="Conversation history">{state.data.messages.map((message) => <li id={`message-${message.id}`} key={message.id} tabIndex={-1} className={message.sender_id === user.id ? 'message-own' : ''}><div className="message-bubble-heading"><span className="message-sender">{message.sender_id === user.id ? 'You' : state.data.member.display_name}</span>{<MessageActions message={message} userId={user.id} onFeedback={setNotice} onReply={(id) => {
        if (sending.current) { setNotice('Wait for your current message to finish sending.'); return }
        setReplyId(id); attempt.current = null; setNotice('')
        document.getElementById('message-body')?.focus()
      }} onDeleted={(saved) => { state.confirmHidden(saved); setNotice('Message deleted for you.'); onMessageDeleted() }} onUnsent={(saved) => { state.confirmUnsent(saved); setNotice('Message unsent.') }} />}</div>{message.reply_to_message_id && !message.unsent_at && <ReplyPreview original={message.reply} user={user} member={state.data.member} onOpen={() => showOriginal(message.reply_to_message_id)} />}<p className={message.unsent_at ? 'message-unsent' : undefined}>{message.unsent_at ? 'This message was unsent.' : message.body}</p><time dateTime={message.created_at} title={new Date(message.created_at).toLocaleString()}>{new Date(message.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {new Date(message.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time></li>)}</ol>
      {!state.data.messages.length && <p>No messages yet. Say hello!</p>}
      {replyId && <div className="message-reply-draft"><ReplyPreview original={replyTarget} user={user} member={state.data.member} /><button type="button" disabled={busy} aria-label="Cancel reply" onClick={() => { setReplyId(null); attempt.current = null }}>×</button></div>}
      <form onSubmit={send} className="message-composer"><label htmlFor="message-body">Your message</label><textarea id="message-body" rows={1} placeholder="Write a message…" maxLength={2000} value={draft} disabled={busy} onChange={(event) => { setDraft(event.target.value); attempt.current = null; setNotice('') }} /><button className="primary-button" disabled={busy || !draft.trim()}>{busy ? 'Sending…' : 'Send'}</button></form>
      {sendError && <p role="alert" className="field-error">{sendError}</p>}{notice && <p role="status">{notice}</p>}
    </>}
  </section>
}
export default function Messages({ user }) {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [inboxVersion, setInboxVersion] = useState(0)
  const [feedback, setFeedback] = useState('')
  function refreshInbox() { setInboxVersion((value) => value + 1) }
  function conversationDeleted() {
    refreshInbox(); setFeedback('Conversation deleted for you.'); navigate('/messages', { replace: true })
  }
  const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId || '')
  return <main className={`container messages-page ${userId ? 'message-chat-open' : ''}`}>
    <PendingDeletions key={user.id} userId={user.id} onResolved={conversationDeleted} />
    <div className="messages-layout">
      <aside className="message-sidebar" aria-label="Conversations and member search">
        <div className="message-sidebar-heading"><h1>Messages</h1><p>A little hello goes a long way.</p></div>
        <PeopleSearch user={user} />{feedback && <p role="status">{feedback}</p>}<Inbox key={inboxVersion} />
      </aside>
      <div className="message-content">
        {userId ? validId ? <Conversation key={`${user.id}:${userId}`} user={user} memberId={userId.toLowerCase()} onConversationDeleted={conversationDeleted} onMessageDeleted={refreshInbox} /> : <p>This member link is invalid.</p> : <div className="message-welcome"><span aria-hidden="true">✉</span><h2>Your conversations, together.</h2><p>Select a conversation or search for a member to say hello.</p></div>}
      </div>
    </div>
  </main>
}
