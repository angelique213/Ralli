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

  return (
    <article className="post-card" aria-label={`Post by ${displayName}`}>
      <header className="post-header">
        <div className="post-avatar" aria-hidden="true">{displayName.charAt(0)}</div>
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
          {isLiked ? 'Liked' : 'Like'} · {likeCount}
        </button>
        <button
          type="button"
          className="post-action"
          onClick={() => setShowComments((isOpen) => !isOpen)}
          aria-expanded={showComments}
        >
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
