import { useEffect, useState } from 'react'
import Avatar from './Avatar.jsx'
import { Link } from 'react-router'
import { profilePath } from '../services/connections.js'
import { getActivity, getComments, createComment, saveLike, feedError } from '../services/feed.js'

function PostCard({ post, user, currentProfile }) {
  // Profile edits immediately update this account's visible author details.
  const authorProfile = currentProfile?.id === post.user_id ? currentProfile : post.profiles
  const displayName = authorProfile?.display_name || 'Ralli Member'
  const timestamp = new Date(post.created_at).toLocaleString()
  const [activity, setActivity] = useState(null)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [commentError, setCommentError] = useState('')
  const [retry, setRetry] = useState(0)
  const isLiked = activity?.isLiked || false

  // Gets saved counts and this account's like from the database.
  useEffect(() => {
    let active = true
    getActivity(post.id, user?.id).then((data) => { if (active) setActivity(data) })
      .catch((problem) => { if (active) setError(feedError(problem)) })
    return () => { active = false }
  }, [post.id, user?.id, retry])

  async function loadComments() {
    setLoadingComments(true)
    setCommentError('')
    try {
      setComments(await getComments(post.id))
    } catch (problem) {
      setCommentError(feedError(problem))
    } finally {
      setLoadingComments(false)
    }
  }

  function toggleComments() {
    setShowComments(!showComments)
    if (!showComments) loadComments()
  }

  async function handleComment(event) {
    event.preventDefault()
    if (!user || busy || !commentText.trim()) return
    setBusy(true)
    setError('')
    try {
      // Adds the saved row, then clears the input.
      const saved = await createComment(post.id, commentText.trim(), user.id)
      setComments((current) => [...current, saved])
      setCommentText('')
      setActivity(await getActivity(post.id, user.id))
    } catch (problem) {
      setError(feedError(problem))
    } finally {
      setBusy(false)
    }
  }

  async function handleLike() {
    if (!user || busy || !activity) return
    setBusy(true)
    setError('')
    try {
      await saveLike(post.id, user.id, isLiked)
      setActivity(await getActivity(post.id, user.id))
    } catch (problem) {
      setActivity(null)
      setError(feedError(problem))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="post-card" aria-label={`Post by ${displayName}`}>
      <header className="post-header">
        <Link className="author-link" to={profilePath(post.user_id, user?.id)} aria-label={`View ${displayName}’s profile`}><Avatar profile={authorProfile} /></Link>
        <div className="post-author">
          <h3><Link className="author-link" to={profilePath(post.user_id, user?.id)}>{displayName}</Link></h3>
          <p><time dateTime={post.created_at}>{timestamp}</time></p>
        </div>
      </header>
      <p className="post-text">{post.body}</p>
      {/* Keeps the saved counts separate from the action buttons. */}
      <div className="post-counts" aria-live="polite">
        <span>{activity ? `${activity.likeCount} ${activity.likeCount === 1 ? 'like' : 'likes'}` : 'Loading likes…'}</span>
        <span>{activity ? `${activity.commentCount} ${activity.commentCount === 1 ? 'comment' : 'comments'}` : 'Loading comments…'}</span>
      </div>
      <div className="post-actions">
        <button
          type="button"
          className="post-action"
          disabled={!user || busy || !activity}
          onClick={handleLike}
          aria-pressed={isLiked}
        >
          <svg className="action-icon" viewBox="0 0 24 24" aria-hidden="true" fill={isLiked ? 'currentColor' : 'none'}>
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
          </svg>
          {isLiked ? 'Liked' : 'Like'}
        </button>
        <button
          type="button"
          className="post-action"
          disabled={loadingComments || busy}
          onClick={toggleComments}
          aria-expanded={showComments}
        >
          <svg className="action-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none">
            <path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.9L3 21l1.4-5a9 9 0 1 1 16.6-4.5Z" />
          </svg>
          Comment
        </button>
      </div>
      {error && <div role="alert"><p className="field-error">{error}</p><button type="button" className="text-button" onClick={() => { setError(''); setRetry((value) => value + 1) }}>Reload counts</button></div>}
      {showComments && (
        <section className="comment-section" aria-label="Comments">
          {loadingComments && <p role="status">Loading comments…</p>}
          {commentError && <div role="alert"><p className="field-error">{commentError}</p><button type="button" className="text-button" onClick={loadComments}>Retry comments</button></div>}
          {/* Displays the comments saved for this post. */}
          <ul className="comment-list" aria-live="polite">
            {comments.map((comment) => {
              const commenter = currentProfile?.id === comment.user_id ? currentProfile : comment.profiles
              const author = commenter?.display_name || 'Ralli Member'
              return (
                <li key={comment.id} className="comment-item">
                  <Link className="author-link" to={profilePath(comment.user_id, user?.id)} aria-label={`View ${author}’s profile`}><Avatar profile={commenter} small /></Link>
                  <div className="comment-content">
                    <div className="comment-bubble">
                      <strong><Link className="author-link" to={profilePath(comment.user_id, user?.id)}>{author}</Link></strong>
                      <p>{comment.body}</p>
                    </div>
                    <time className="comment-time" dateTime={comment.created_at}>
                      {new Date(comment.created_at).toLocaleString()}
                    </time>
                  </div>
                </li>
              )
            })}
          </ul>
          {/* Keeps the input below all saved comments. */}
          {!user && <p>Log in to add a comment.</p>}
          <form className="comment-form" onSubmit={handleComment}>
            <label>
              <span className="visually-hidden">Write a comment</span>
              <input
                type="text"
                maxLength={2000}
                disabled={!user || busy || loadingComments}
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Add to the conversation…"
              />
            </label>
            <button type="submit" className="primary-button" disabled={!user || busy || loadingComments || Boolean(commentError) || !commentText.trim()}>
              {busy ? 'Saving…' : 'Send'}
            </button>
          </form>
        </section>
      )}
    </article>
  )
}

export default PostCard
