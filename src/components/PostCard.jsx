// Props let us reuse this card with different post details.
function PostCard({ displayName, username, timestamp, text }) {
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
      {/* These buttons are just part of the UI for now. */}
      <div className="post-actions">
        <button type="button" className="post-action">Like</button>
        <button type="button" className="post-action">Comment</button>
      </div>
    </article>
  )
}

export default PostCard
