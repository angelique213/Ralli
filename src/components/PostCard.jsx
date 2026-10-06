import { useState } from 'react'

// Props let us reuse this card with different post details.
function PostCard({ displayName, username, timestamp, text, initialLikes = 0 }) {
  // Each card remembers whether this user has liked it.
  const [isLiked, setIsLiked] = useState(false)
  // Adds one to the starting count only when this post is liked.
  const likeCount = initialLikes + (isLiked ? 1 : 0)

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
        {/* Comments are still a UI preview. */}
        <button type="button" className="post-action">Comment</button>
      </div>
    </article>
  )
}

export default PostCard
