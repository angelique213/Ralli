import { useEffect, useRef, useState } from 'react'
import PostCard from '../components/PostCard.jsx'
import PostDeletionFeedback from '../components/PostDeletionFeedback.jsx'
import { usePostDeletion } from '../components/usePostDeletion.js'
import Avatar from '../components/Avatar.jsx'
import { validatePostImage } from '../services/postImages.js'
import { getPosts, getProfile, createPost, feedError } from '../services/feed.js'

function Home({ user, onNavigate }) {
  // Stores the text the user is typing.
  const [postText, setPostText] = useState('')
  const [posts, setPosts] = useState([])
  const deletion = usePostDeletion(setPosts, user.id)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [reload, setReload] = useState(0)
  const [ownProfile, setOwnProfile] = useState(null)
  const [profileError, setProfileError] = useState('')
  const [profileRetry, setProfileRetry] = useState(0)
  const [photo, setPhoto] = useState(null)
  const [photoError, setPhotoError] = useState('')
  const [validatingPhoto, setValidatingPhoto] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [uncertainSave, setUncertainSave] = useState(false)
  const posting = useRef(false)
  const selection = useRef(0)

  // Release each local preview when it is replaced, removed, or the page closes.
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.preview) }, [photo])
  useEffect(() => () => { selection.current += 1 }, [])

  async function selectPhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const request = ++selection.current
    setValidatingPhoto(true)
    setPhotoError('')
    try {
      await validatePostImage(file)
      if (request === selection.current) setPhoto({ file, preview: URL.createObjectURL(file) })
    } catch (problem) {
      if (request === selection.current) setPhotoError(problem.message)
    } finally { if (request === selection.current) setValidatingPhoto(false) }
  }


  // Returning from Profile reads the latest saved composer photo.
  useEffect(() => {
    let active = true
    getProfile(user.id).then((saved) => { if (active) setOwnProfile(saved) })
      .catch((problem) => { if (active) setProfileError(feedError(problem)) })
    return () => { active = false }
  }, [user.id, profileRetry])

  // Loads real posts when this feed opens or the user retries.
  useEffect(() => {
    let active = true
    getPosts().then((data) => { if (active) setPosts(data) })
      .catch((problem) => { if (active) setError(feedError(problem)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])

  async function handlePost() {
    if (!user || posting.current || saving || loading || validatingPhoto || uncertainSave || error) return
    const trimmedText = postText.trim()
    if (!trimmedText && !photo) return
    posting.current = true
    setSaving(true)
    setSaveError('')
    setSaveStatus('Preparing post…')
    try {
      // Shows the post only after the database confirms it was saved.
      const newPost = await createPost(trimmedText, user.id, photo?.file, setSaveStatus)
      setPosts((currentPosts) => [newPost, ...currentPosts])
      setPostText('')
      setPhoto(null)
      setPhotoError('')
    } catch (problem) {
      setSaveError(feedError(problem))
      setUncertainSave(Boolean(problem.uncertain))
    } finally {
      posting.current = false
      setSaving(false)
      setSaveStatus('')
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
            {/* Uses this account’s saved profile beside the composer. */}
            <div className="composer-body">
              <Avatar profile={ownProfile} />
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
            <div className="post-photo-controls">
              <label className="post-action post-photo-picker">
                {photo ? 'Replace photo' : 'Add photo'}
                <input className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label={photo ? 'Replace photo' : 'Add photo'} aria-describedby="post-photo-help" disabled={!user || saving || validatingPhoto || uncertainSave} onChange={selectPhoto} />
              </label>
              {photo && <button type="button" className="post-action" disabled={saving || validatingPhoto || uncertainSave} onClick={() => { setPhoto(null); setPhotoError('') }}>Remove photo</button>}
              <small id="post-photo-help">One JPEG, PNG, or WebP · up to 5 MB</small>
            </div>
            {validatingPhoto && <p role="status">Checking photo…</p>}
            {photoError && <p role="alert" className="field-error">{photoError}</p>}
            {photo && <figure className="post-photo-preview"><img src={photo.preview} alt="Selected photo preview" /><figcaption>{photo.file.name}</figcaption></figure>}
            <div className="composer-footer">
              <p>Share a moment with the Ralli community.</p>
              <button
                type="button"
                className="primary-button"
                onClick={handlePost}
                disabled={!user || saving || loading || Boolean(error) || validatingPhoto || uncertainSave || (!postText.trim() && !photo)}
              >
                {saving ? 'Posting…' : 'Post'}
              </button>
            </div>
            {profileError && <p className="field-error" role="alert">Could not load your composer photo. {profileError} <button type="button" className="text-button" onClick={() => { setProfileError(''); setProfileRetry((value) => value + 1) }}>Retry photo</button></p>}
            {saveStatus && <p role="status">{saveStatus}</p>}
            {uncertainSave && <button type="button" className="post-action" onClick={() => window.location.reload()}>Refresh to check post</button>}
            {saveError && <p role="alert" className="field-error">{saveError}</p>}
          </section>

          <section className="post-list" aria-labelledby="feed-title">
            <h2 id="feed-title">Around the community</h2>
            <PostDeletionFeedback {...deletion} />
            {loading && <p role="status">Loading posts…</p>}
            {error && <div role="alert"><p className="field-error">{error}</p><button type="button" className="post-action" onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1) }}>Retry feed</button></div>}
            {!loading && !error && posts.length === 0 && <p>No posts yet. Be the first to share a moment.</p>}
            {/* Displays each post using the same reusable card. */}
            {posts.map((post) => (
              <PostCard
                onDeleted={deletion.onDeleted}
                user={user}
                key={post.id}
                post={post}
              />
            ))}
          </section>
        </div>
        {/* Opens the community challenges. */}
        <aside className="challenge-preview" aria-labelledby="challenge-title">
          <span className="coming-soon-badge">Grow together</span>
          <div className="challenge-symbol" aria-hidden="true">✦</div>
          <p className="eyebrow">Better together</p>
          <h2 id="challenge-title">Challenge yourself.<br />Connect with others.</h2>
          <p>Small steps can spark great connections. Find a goal and grow with the Ralli community.</p>
          <button className="primary-button" onClick={() => onNavigate('challenges')}>Discover Challenges</button>
        </aside>
      </div>
    </main>
  )
}

export default Home
