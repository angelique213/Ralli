import { useEffect, useId, useRef, useState } from 'react'
import { unsendMessage, hideMessage, getMessageText } from '../services/messages.js'

import { deleteConversationSafely } from '../services/conversationDeletion.js'
import ForwardMessage from './ForwardMessage.jsx'
import { readPending } from '../services/pendingDeletion.js'

export default function MessageActions({ message, userId, memberId, onUnsent, onDeleted, onReply, onFeedback }) {
  const menu = useRef(null)
  const dialog = useRef(null)
  const popup = useRef(null)
  const cancel = useRef(null)
  const pending = useRef(false)
  const active = useRef(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [forwarding, setForwarding] = useState(false)
  const title = useId()
  const [action, setAction] = useState('hide')
  const requestId = useRef(null)
  const conversation = Boolean(memberId)
  function restoreFocus() {
    const bubble = menu.current?.closest('li')
    if (!conversation && window.matchMedia('(max-width: 768px)').matches) bubble?.focus()
    else menu.current?.querySelector('summary').focus()
  }
  async function textAction(kind) {
    menu.current.open = false
    restoreFocus()
    if (kind === 'forward') { setForwarding(true); return }
    try {
      // Clipboard writes must start during the user's gesture on mobile browsers.
      if (kind === 'copy') {
        await navigator.clipboard.writeText(message.body)
        onFeedback?.('Message copied.')
      } else {
        await getMessageText(message.id)
        onReply?.(message.id)
      }
    } catch (problem) { onFeedback?.(kind === 'copy' ? 'Could not copy. Clipboard access requires HTTPS and browser permission.' : problem.message) }
  }
  const label = action === 'unsend' ? 'Unsend for everyone' : conversation ? 'Delete conversation' : 'Delete for me'
  function openAction(next) {
    setAction(next); menu.current.open = false; setError('')
    if (conversation) {
      try { requestId.current = readPending(window.localStorage, userId, memberId)?.requestId || null }
      catch (problem) { setError(problem.message) }
    }
    dialog.current.showModal(); cancel.current.focus()
  }
  useEffect(() => {
    active.current = true
    function dismiss(event) {
      if (menu.current && !menu.current.contains(event.target)) menu.current.open = false
    }
    function syncPending() {
      if (!conversation || !dialog.current?.open) return
      try {
        const record = readPending(window.localStorage, userId, memberId)
        if (record) requestId.current = record.requestId
        else if (requestId.current && !pending.current) {
          dialog.current.close()
          menu.current?.querySelector('summary').focus()
        }
      } catch (problem) { setError(problem.message) }
    }
    window.addEventListener('storage', syncPending)
    window.addEventListener('ralli-pending-deletion', syncPending)
    const bubble = conversation ? null : menu.current.closest('li')
    const mobile = window.matchMedia('(max-width: 768px)')
    let timer
    let start
    function clearPress() { clearTimeout(timer) }
    function showBubbleMenu(event) {
      if (!mobile.matches || menu.current.contains(event.target) || event.target.closest('dialog')) return
      if (event.type === 'contextmenu') event.preventDefault()
      menu.current.open = true
    }
    function keyOpen(event) {
      if (mobile.matches && event.target === bubble && ['Enter', ' '].includes(event.key)) { event.preventDefault(); showBubbleMenu(event) }
    }
    function press(event) {
      if (!mobile.matches || menu.current.contains(event.target) || event.target.closest('dialog')) return
      start = { x: event.clientX, y: event.clientY }
      timer = setTimeout(() => showBubbleMenu(event), 500)
    }
    function move(event) { if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) clearPress() }
    function viewportChanged() { clearPress(); if (menu.current) menu.current.open = false }
    function focusable() { if (bubble) bubble.tabIndex = mobile.matches ? 0 : -1; viewportChanged() }
    focusable()
    bubble?.addEventListener('click', showBubbleMenu)
    bubble?.addEventListener('contextmenu', showBubbleMenu)
    bubble?.addEventListener('keydown', keyOpen)
    bubble?.addEventListener('pointerdown', press)
    bubble?.addEventListener('pointermove', move)
    bubble?.addEventListener('pointerup', clearPress)
    bubble?.addEventListener('pointercancel', clearPress)
    mobile.addEventListener('change', focusable)
    window.addEventListener('resize', viewportChanged)
    document.addEventListener('pointerdown', dismiss)
    return () => { active.current = false; clearPress()
      bubble?.removeEventListener('click', showBubbleMenu)
      bubble?.removeEventListener('contextmenu', showBubbleMenu)
      bubble?.removeEventListener('keydown', keyOpen)
      bubble?.removeEventListener('pointerdown', press)
      bubble?.removeEventListener('pointermove', move)
      bubble?.removeEventListener('pointerup', clearPress)
      bubble?.removeEventListener('pointercancel', clearPress)
      mobile.removeEventListener('change', focusable)
      window.removeEventListener('resize', viewportChanged)
      document.removeEventListener('pointerdown', dismiss); window.removeEventListener('storage', syncPending); window.removeEventListener('ralli-pending-deletion', syncPending) }
  }, [conversation, userId, memberId])
  async function confirm() {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      const result = action === 'unsend' ? await unsendMessage(message.id) : conversation ? await deleteConversationSafely(userId, memberId, requestId.current) : await hideMessage(message.id)
      if (!active.current) return
      dialog.current.close()
      // The menu disappears after unsending, so return focus to its message.
      if (action === 'unsend') { menu.current.closest('li').focus(); onUnsent(result) }
      else {
        menu.current.closest('.message-thread')?.querySelector('textarea')?.focus()
        onDeleted(result)
      }
    } catch (problem) {
      if (conversation) {
        try { requestId.current = readPending(window.localStorage, userId, memberId)?.requestId || requestId.current } catch { /* Keep the original ID if storage is unavailable. */ }
      }
      if (active.current) setError(problem.message)
    } finally { pending.current = false; if (active.current) setBusy(false) }
  }
  return <div className={`message-options ${conversation ? 'conversation-options' : 'bubble-options'}`}>
    <details ref={menu} onToggle={() => {
      if (!menu.current.open || !popup.current) return
      // Keep the floating actions within the visible screen.
      const anchor = (!conversation && window.matchMedia('(max-width: 768px)').matches ? menu.current.closest('li') : menu.current.querySelector('summary')).getBoundingClientRect()
      const box = popup.current.getBoundingClientRect()
      const viewport = window.visualViewport
      const left = viewport?.offsetLeft || 0
      const top = viewport?.offsetTop || 0
      const width = viewport?.width || window.innerWidth
      const height = viewport?.height || window.innerHeight
      popup.current.style.left = `${Math.max(left + 8, Math.min(anchor.right - box.width, left + width - box.width - 8))}px`
      const below = anchor.bottom + 4
      popup.current.style.top = `${Math.max(top + 8, below + box.height < top + height - 8 ? below : anchor.top - box.height - 4)}px`
      if (!conversation && window.matchMedia('(max-width: 768px)').matches) popup.current.querySelector('button')?.focus({ preventScroll: true })
    }} onKeyDown={(event) => {
      if (event.key === 'Escape') { menu.current.open = false; restoreFocus() }
    }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) menu.current.open = false }}>
      <summary aria-label={conversation ? 'Conversation options' : 'Message options'}><span aria-hidden="true">⋯</span></summary>
      <div ref={popup} className="message-options-popup">
        {!conversation && !message.unsent_at && <>
          <button type="button" onClick={() => textAction('reply')}><span aria-hidden="true">↩</span>Reply</button>
          <button type="button" onClick={() => textAction('copy')}><span aria-hidden="true">▣</span>Copy</button>
        </>}
        {message?.sender_id === userId && !message.unsent_at && <button type="button" onClick={() => openAction('unsend')}><span aria-hidden="true">↶</span>Unsend for everyone</button>}
        {!conversation && !message.unsent_at && <button type="button" onClick={() => textAction('forward')}><span aria-hidden="true">↗</span>Forward</button>}
        <button type="button" onClick={() => openAction('hide')}><span aria-hidden="true">×</span>{conversation ? 'Delete conversation' : 'Delete for me'}</button>
      </div>
    </details>
    <dialog ref={dialog} className="post-delete-dialog message-unsend-dialog" aria-labelledby={title} aria-describedby={`${title}-description`}
      onCancel={(event) => { if (pending.current) event.preventDefault(); else restoreFocus() }}>
      <h2 id={title}>{label}?</h2>
      <p id={`${title}-description`}>{action === 'unsend' ? 'Unsend this message for everyone? This cannot be undone. They may have already seen it.' : conversation ? 'Remove existing messages in this conversation from your view only? The other person keeps their messages. New messages can reopen the conversation without restoring this history.' : 'Remove this message from your view only? The other person will still see it unless it was unsent. This cannot be undone.'}</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      {busy && <p role="status">Working…</p>}
      <div className="post-delete-actions"><button ref={cancel} type="button" className="post-action" disabled={busy} onClick={() => { dialog.current.close(); restoreFocus() }}>Cancel</button><button type="button" className="primary-button" disabled={busy} onClick={confirm}>{busy ? 'Working…' : label}</button></div>
    </dialog>
    {forwarding && <ForwardMessage message={message} userId={userId} onClose={() => { setForwarding(false); restoreFocus() }} onSent={() => onFeedback?.('Message forwarded.')} />}
  </div>
}
