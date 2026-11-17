import { useEffect, useId, useRef, useState } from 'react'
import { deletePost, updatePost } from '../services/feed.js'

function PostActions({ post, user, onDeleted, onUpdated }) {
  const menu = useRef(null)
  const dialog = useRef(null)
  const cancelButton = useRef(null)
  const pending = useRef(false)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(post.body)
  const [success, setSuccess] = useState('')
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (open) {
      dialog.current.showModal()
      if (editing) input.current.focus()
      else cancelButton.current.focus()
    }
  }, [open, editing])
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    function closeMenu(event) {
      if (menu.current && !menu.current.contains(event.target)) menu.current.open = false
    }
    document.addEventListener('pointerdown', closeMenu)
    return () => document.removeEventListener('pointerdown', closeMenu)
  }, [])

  function openConfirmation(edit = false) {
    setEditing(edit)
    setText(post.body)
    setSuccess('')
    menu.current.open = false
    setError('')
    setOpen(true)
  }

  // Keep the draft separate until Supabase confirms the saved text.
  async function saveEdit(event) {
    event.preventDefault()
    if (pending.current || user.id !== post.user_id) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const saved = await updatePost(post.id, user.id, text, Boolean(post.image_path))
      onUpdated(saved)
      dialog.current.close()
      setSuccess('Post updated.')
    } catch (problem) {
      setError(problem.message || 'Could not confirm the update. Refresh before retrying.')
    } finally { pending.current = false; setBusy(false) }
  }

  async function confirmDelete() {
    if (pending.current || user.id !== post.user_id) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const deleted = await deletePost(post.id, user.id)
      dialog.current.close()
      // The parent removes the card now, then handles photo cleanup separately.
      onDeleted(deleted)
    } catch (problem) {
      setError(problem.message || 'Could not confirm deletion. Refresh before retrying.')
    } finally { pending.current = false; setBusy(false) }
  }

  return <div className="post-delete-control">
    <details ref={menu} className="post-options" onKeyDown={(event) => {
      if (event.key === 'Escape') { menu.current.open = false; menu.current.querySelector('summary').focus() }
    }}>
      <summary aria-label="Post options"><span aria-hidden="true">⋯</span></summary>
      <div className="post-options-popup"><button type="button" onClick={() => openConfirmation(true)}>Edit Post</button><button type="button" onClick={() => openConfirmation(false)}>Delete Post</button></div>
    </details>
    {/* The native dialog traps focus and supports Escape when not deleting. */}
    <dialog ref={dialog} className="post-delete-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(event) => { if (pending.current) event.preventDefault() }}
      onClose={() => { setOpen(false); menu.current?.querySelector('summary').focus() }}>
      <h2 id={titleId}>{editing ? 'Edit Post' : 'Delete Post'}</h2>
      {editing ? <form onSubmit={saveEdit}>
        <p id={descriptionId}>Update your text or caption. Your photo stays unchanged.</p>
        <label htmlFor={`${titleId}-text`}>Post text</label>
        <textarea ref={input} id={`${titleId}-text`} className="post-edit-input" rows={5} maxLength={5000} value={text} disabled={busy} onChange={(event) => setText(event.target.value)} />
        <small>{text.length}/5000 characters</small>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="post-delete-actions">
          <button type="button" className="post-action" disabled={busy} onClick={() => dialog.current.close()}>Cancel</button>
          <button type="submit" className="primary-button" disabled={busy || (!text.trim() && !post.image_path)}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form> : <>
      <p id={descriptionId}>Are you sure you want to delete this post? This action cannot be undone.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      {busy && <p role="status">Deleting post…</p>}
      <div className="post-delete-actions">
        <button ref={cancelButton} type="button" className="post-action" disabled={busy} onClick={() => dialog.current.close()}>Cancel</button>
        <button type="button" className="primary-button" disabled={busy} onClick={confirmDelete}>{busy ? 'Deleting…' : 'Delete'}</button>
      </div>
      </>}
    </dialog>
    {success && <span className="post-edit-success" role="status">{success}</span>}
  </div>
}
export default PostActions
