import { useState } from 'react'

// Props let us reuse this card with different post details.
function PostCard({ displayName, username, timestamp, text, initialLikes = 0 }) {
  // Each card remembers whether this user has liked it.
  const [isLiked, setIsLiked] = useState(false)
  // Adds one to the starting count only when this post is liked.
  const likeCount = initialLikes + (isLiked ? 1 : 0)

  // Stores the comments and the text being typed for this post.
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  // Shows or hides the comment section.
  const [showComments, setShowComments] = useState(false)

  function handleComment(event) {
    // Keeps the form from refreshing the page.
    event.preventDefault()
    const trimmedText = commentText.trim()
    if (!trimmedText) return

    const newComment = {
      id: crypto.randomUUID(),
      author: 'Ralli Student',
      text: trimmedText,
    }
    // Adds a new comment to this post only.
    setComments((currentComments) => [...currentComments, newComment])
    // Clears the comment box after submitting.
    setCommentText('')
  }

  function handleLike() {
    // Adds or removes this user's like.
    setIsLiked((wasLiked) => !wasLiked)
  }

  // Makes initials and picks a consistent avatar color for each name.
  const initials = displayName.split(' ').map((name) => name.charAt(0)).slice(0, 2).join('')
  const avatarColors = ['avatar-blue', 'avatar-purple', 'avatar-coral']
  const avatarColor = avatarColors[displayName.charCodeAt(0) % avatarColors.length]

  return (
    <article className="post-card" aria-label={`Post by ${displayName}`}>
      <header className="post-header">
        <div className={`post-avatar ${avatarColor}`} aria-hidden="true">{initials}</div>
        <div className="post-author">
          <h3>{displayName}</h3>
          <p>@{username} <span aria-hidden="true">·</span> {timestamp}</p>
        </div>
      </header>
      <p className="post-text">{text}</p>
      <div className="post-actions">
        <button
          type="button"
          className="post-action"
          onClick={handleLike}
          aria-pressed={isLiked}
        >
          <svg className="action-icon" viewBox="0 0 24 24" aria-hidden="true" fill={isLiked ? 'currentColor' : 'none'}>
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
          </svg>
          {isLiked ? 'Liked' : 'Like'} · {likeCount}
        </button>
        <button
          type="button"
          className="post-action"
          onClick={() => setShowComments((isOpen) => !isOpen)}
          aria-expanded={showComments}
        >
          <svg className="action-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none">
            <path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.9L3 21l1.4-5a9 9 0 1 1 16.6-4.5Z" />
          </svg>
          Comment · {comments.length}
        </button>
      </div>
      {showComments && (
        <section className="comment-section" aria-label="Comments">
          <form className="comment-form" onSubmit={handleComment}>
            <label>
              Write a comment
              <textarea
                rows={2}
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Add to the conversation…"
              />
            </label>
            <button type="submit" className="primary-button" disabled={!commentText.trim()}>
              Add comment
            </button>
          </form>
          {/* Displays the comments saved for this post. */}
          <ul className="comment-list" aria-live="polite">
            {comments.map((comment) => (
              <li key={comment.id} className="comment-item">
                <strong>{comment.author}</strong>
                <p>{comment.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}

export default PostCard
