import { useEffect, useRef } from 'react'

function PostDeletionFeedback({ notices, retryCleanup, dismiss }) {
  const region = useRef(null)
  // Move focus to a stable place when the card and its dialog disappear.
  useEffect(() => { if (notices.length) region.current?.focus() }, [notices.length])
  if (!notices.length) return null
  return <div ref={region} className="post-deletion-feedback" tabIndex={-1} aria-label="Post deletion updates">
    {notices.map((notice) => <div key={notice.id} className="post-deletion-notice">
      {notice.status === 'error' ? <>
        <p role="alert" className="field-error">{notice.error}</p>
        <button type="button" className="post-action" onClick={() => retryCleanup(notice)}>Retry photo cleanup</button>
      </> : <p role="status">{notice.status === 'cleaning' ? 'Post deleted. Removing its photo…' : notice.image_path ? 'Post and photo deleted.' : 'Post deleted.'}</p>}
      {notice.status === 'done' && <button type="button" className="text-button" onClick={() => dismiss(notice.id)}>Dismiss</button>}
    </div>)}
  </div>
}
export default PostDeletionFeedback
