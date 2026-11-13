import { useEffect, useId, useRef, useState } from 'react'
import { deletePost } from '../services/feed.js'

function PostDeleteControl({ post, user, onDeleted }) {
  const menu = useRef(null)
  const dialog = useRef(null)
  const cancelButton = useRef(null)
  const deleting = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    function closeMenu(event) {
      if (menu.current && !menu.current.contains(event.target)) menu.current.open = false
    }
    document.addEventListener('pointerdown', closeMenu)
    return () => document.removeEventListener('pointerdown', closeMenu)
  }, [])

  function openConfirmation() {
    menu.current.open = false
    setError('')
    dialog.current.showModal()
    cancelButton.current.focus()
  }

  async function confirmDelete() {
    if (deleting.current || user.id !== post.user_id) return
    deleting.current = true
    setBusy(true)
    setError('')
    try {
      const deleted = await deletePost(post.id, user.id)
      dialog.current.close()
      // The parent removes the card now, then handles photo cleanup separately.
      onDeleted(deleted)
    } catch (problem) {
      setError(problem.message || 'Could not confirm deletion. Refresh before retrying.')
    } finally { deleting.current = false; setBusy(false) }
  }

  return <div className="post-delete-control">
    <details ref={menu} className="post-options" onKeyDown={(event) => {
      if (event.key === 'Escape') { menu.current.open = false; menu.current.querySelector('summary').focus() }
    }}>
      <summary aria-label="Post options"><span aria-hidden="true">⋯</span></summary>
      <div className="post-options-popup"><button type="button" onClick={openConfirmation}>Delete Post</button></div>
    </details>
    {/* The native dialog traps focus and supports Escape when not deleting. */}
    <dialog ref={dialog} className="post-delete-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(event) => { if (deleting.current) event.preventDefault() }}
      onClose={() => menu.current?.querySelector('summary').focus()}>
      <h2 id={titleId}>Delete Post</h2>
      <p id={descriptionId}>Are you sure you want to delete this post? This action cannot be undone.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      {busy && <p role="status">Deleting post…</p>}
      <div className="post-delete-actions">
        <button ref={cancelButton} type="button" className="post-action" disabled={busy} onClick={() => dialog.current.close()}>Cancel</button>
        <button type="button" className="primary-button" disabled={busy} onClick={confirmDelete}>{busy ? 'Deleting…' : 'Delete'}</button>
      </div>
    </dialog>
  </div>
}
export default PostDeleteControl
