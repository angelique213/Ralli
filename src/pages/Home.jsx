import { useEffect, useState } from 'react'
import PostCard from '../components/PostCard.jsx'
import { getPosts, createPost, feedError } from '../services/feed.js'

function Home({ user, onNavigate }) {
  // Stores the text the user is typing.
  const [postText, setPostText] = useState('')
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [reload, setReload] = useState(0)

  // Loads real posts when this feed opens or the user retries.
  useEffect(() => {
    let active = true
    getPosts().then((data) => { if (active) setPosts(data) })
      .catch((problem) => { if (active) setError(feedError(problem)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])

  async function handlePost() {
    if (!user || saving || loading) return
    const trimmedText = postText.trim()
    if (!trimmedText) return
    setSaving(true)
    setSaveError('')
    try {
      // Shows the post only after the database confirms it was saved.
      const newPost = await createPost(trimmedText, user.id)
      setPosts((currentPosts) => [newPost, ...currentPosts])
      setPostText('')
    } catch (problem) {
      setSaveError(feedError(problem))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="container home">
      <div className="feed-intro">
        <p className="eyebrow">A place to connect</p>
        <h1>Your Ralli feed</h1>
        <p className="welcome-text">Small moments. Shared progress. Find your people.</p>
      </div>

      <div className="home-layout">
        <div className="feed">
          <section className="create-post" aria-labelledby="create-post-title">
            <h2 id="create-post-title">Create Post</h2>
            {!user && <p>Log in to post, like, and comment. <button type="button" className="text-button" onClick={() => onNavigate('login')}>Login</button></p>}
            {/* Puts a sample avatar beside the composer. */}
            <div className="composer-body">
              <div className="post-avatar avatar-purple" aria-hidden="true">RS</div>
              <div className="composer-input">
                <label htmlFor="post-text">What would you like to share?</label>
                <textarea
                  disabled={!user || saving}
                  id="post-text"
                  rows={4}
                  maxLength={5000}
                  placeholder="Share a moment, a small win, or a new idea…"
                  value={postText}
                  onChange={(event) => setPostText(event.target.value)}
                />
              </div>
            </div>
            <div className="composer-footer">
              <p>Share a moment with the Ralli community.</p>
              <button
                type="button"
                className="primary-button"
                onClick={handlePost}
                disabled={!user || saving || loading || Boolean(error) || !postText.trim()}
              >
                {saving ? 'Posting…' : 'Post'}
              </button>
            </div>
            {saveError && <p role="alert" className="field-error">{saveError}</p>}
          </section>

          <section className="post-list" aria-labelledby="feed-title">
            <h2 id="feed-title">Around the community</h2>
            {loading && <p role="status">Loading posts…</p>}
            {error && <div role="alert"><p className="field-error">{error}</p><button type="button" className="post-action" onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1) }}>Retry feed</button></div>}
            {!loading && !error && posts.length === 0 && <p>No posts yet. Be the first to share a moment.</p>}
            {/* Displays each post using the same reusable card. */}
            {posts.map((post) => (
              <PostCard
                user={user}
                key={post.id}
                post={post}
              />
            ))}
          </section>
        </div>
        {/* Shows a preview of future challenges. */}
        <aside className="challenge-preview" aria-labelledby="challenge-title">
          <span className="coming-soon-badge">Coming soon</span>
          <div className="challenge-symbol" aria-hidden="true">✦</div>
          <p className="eyebrow">Better together</p>
          <h2 id="challenge-title">Challenge yourself.<br />Connect with others.</h2>
          <p>Small steps can spark great connections. Shared challenges are on their way to Ralli.</p>
          <div className="challenge-hint">A little courage. A little community.</div>
        </aside>
      </div>
    </main>
  )
}

export default Home
