import { useEffect, useRef, useState } from 'react'
import PostCard from '../components/PostCard.jsx'
import ConnectButton from '../components/ConnectButton.jsx'
import ProfileConnections from '../components/ProfileConnections.jsx'
import { getProfile, getUserPosts, feedError } from '../services/feed.js'
import { profileImageUrl, saveProfile, uploadProfileImage } from '../services/profile.js'

function Profile({ user, onNavigate, profileId = user.id }) {
  const isOwn = profileId === user.id
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [tab, setTab] = useState('posts')
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [busy, setBusy] = useState('')
  const [saveError, setSaveError] = useState('')
  const [message, setMessage] = useState('')
  const [brokenImages, setBrokenImages] = useState({})
  const [viewer, setViewer] = useState(null)
  const [viewerError, setViewerError] = useState(false)
  const photoDialog = useRef(null)

  // The native dialog keeps keyboard focus inside and supports Escape.
  function openPhoto(kind) {
    setViewer({ src: profileImageUrl(profile[`${kind}_path`]), label: kind === 'avatar' ? 'Profile photo' : 'Cover photo' })
    setViewerError(false)
    photoDialog.current.showModal()
  }

  useEffect(() => {
    if (!viewer) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [viewer])

  // Loads saved data again when this page opens or the user retries.
  useEffect(() => {
    let active = true
    Promise.all([getProfile(profileId), getUserPosts(profileId)])
      .then(([savedProfile, savedPosts]) => {
        if (!active) return
        setProfile(savedProfile)
        setPosts(savedPosts)
      })
      .catch((problem) => { if (active) setError(feedError(problem)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [profileId, retry])

  const displayName = profile?.display_name?.trim() || 'Name not set'
  const initials = profile?.display_name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
  const ready = profile && ['bio', 'avatar_path', 'cover_path'].every((field) => field in profile)

  function startEdit() {
    if (!isOwn) return
    setName(profile.display_name || '')
    setBio(profile.bio || '')
    setSaveError('')
    setMessage('')
    setEditing(true)
  }

  async function handleSave(event) {
    event.preventDefault()
    if (!isOwn || busy) return
    setBusy('profile')
    setSaveError('')
    setMessage('')
    try {
      const saved = await saveProfile(user.id, name, bio)
      setProfile(saved)
      setEditing(false)
      setMessage('Your profile was saved.')
    } catch (problem) {
      setSaveError(problem.message || 'Could not save your profile. Please try again.')
    } finally { setBusy('') }
  }

  async function handleImage(event, kind) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!isOwn || !file || busy) return
    setBusy(kind)
    setSaveError('')
    setMessage('')
    try {
      const saved = await uploadProfileImage(user.id, kind, file)
      setProfile(saved)
      setBrokenImages((current) => ({ ...current, [kind]: false }))
      setMessage(`${kind === 'avatar' ? 'Profile' : 'Cover'} photo saved.`)
    } catch (problem) {
      setSaveError(`${problem.message || 'Could not save the image.'} If an upload failed, refresh to check the saved photo before retrying.`)
    } finally { setBusy('') }
  }

  function imagePicker(kind, label) {
    return <label className={`profile-upload ${kind === 'avatar' ? 'profile-camera-button' : ''} ${busy || !ready ? 'profile-upload-disabled' : ''}`}>
      <svg className="profile-camera-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 5 9.5 3h5L16 5h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
      <span className={kind === 'avatar' ? 'visually-hidden' : undefined}>{busy === kind ? 'Uploading…' : label}</span>
      {/* Upload guidance appears only when this control is hovered or focused. */}
      <span className="profile-upload-hint" id={`${kind}-upload-help`}>JPEG, PNG, or WebP · up to 5 MB</span>
      <input className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label={label} aria-describedby={`${kind}-upload-help`} disabled={Boolean(busy) || !ready} onChange={(event) => handleImage(event, kind)} />
    </label>
  }

  function aboutCard() {
    return <section className="profile-about" aria-labelledby="about-title">
      <p className="eyebrow">A little about me</p>
      <h2 id="about-title">About</h2>
      <p className="profile-bio">{profile?.bio || (isOwn ? 'No bio yet. Use Edit Profile to tell your story.' : 'No bio shared yet.')}</p>
      <dl>
        <dt>Display name</dt><dd>{displayName}</dd>
        {isOwn && <><dt>Account email · visible here to you</dt><dd>{user.email || 'No email available'}</dd></>}
        <dt>Posts shared</dt><dd>{posts.length}</dd>
        {profile?.created_at && <><dt>Member since</dt><dd>{new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</dd></>}
      </dl>
    </section>
  }

  return (
    <main className="container profile-page">
      {loading ? <p role="status">Loading your profile and posts…</p> : error ? (
        <section className="profile-empty" role="alert">
          <h1>Could not load your profile</h1><p>{error}</p>
          <button type="button" className="primary-button" onClick={() => { setError(''); setLoading(true); setRetry((value) => value + 1) }}>Try again</button>
        </section>
      ) : !profile ? <section className="profile-empty"><h1>Profile not found</h1><p>This member may no longer be available.</p><button className="primary-button" onClick={() => onNavigate('explore')}>Explore members</button></section> : <>
        <section className="profile-hero" aria-labelledby="profile-name">
          <div className="profile-cover">
            {profile?.cover_path && !brokenImages.cover && <button type="button" className="profile-cover-view-button" aria-label="View cover photo" aria-haspopup="dialog" onClick={() => openPhoto('cover')}>
              <img src={profileImageUrl(profile.cover_path)} alt="Your cover photo" onError={() => setBrokenImages((current) => ({ ...current, cover: true }))} />
            </button>}
            {isOwn && <div className="profile-cover-action">{imagePicker('cover', 'Change cover photo')}</div>}
          </div>
          <div className="profile-identity">
            <div className="profile-photo-group">
              <div className="profile-photo">
                {profile?.avatar_path && !brokenImages.avatar ? <button type="button" className="profile-photo-view-button" aria-label="View profile photo" aria-haspopup="dialog" onClick={() => openPhoto('avatar')}>
                  <img src={profileImageUrl(profile.avatar_path)} alt={`${displayName}'s profile`} onError={() => setBrokenImages((current) => ({ ...current, avatar: true }))} />
                </button> : <span aria-label="Profile initials">{initials}</span>}
              </div>
              {isOwn && imagePicker('avatar', 'Change profile photo')}
            </div>
            <div className="profile-details">
              <h1 id="profile-name">{displayName}</h1>
              <p className="profile-post-count">{posts.length} {posts.length === 1 ? 'post' : 'posts'}</p>
              {profile?.bio && <p className="profile-bio">{profile.bio}</p>}
            </div>
            <div className="profile-main-action">{isOwn ? <button type="button" className="primary-button" disabled={!ready || Boolean(busy)} onClick={startEdit}>Edit Profile</button> : <ConnectButton user={user} targetId={profileId} />}</div>
          </div>
          <div className="profile-feedback">
            {isOwn && !ready && <p role="status">Profile editing needs the profile customization migration. Apply supabase/migrations/20261030_profile_customization.sql, then refresh this page.</p>}
            {(brokenImages.avatar || brokenImages.cover) && <p role="alert">A saved image could not load. Check your connection or choose a new photo.</p>}
            {busy && <p role="status">{busy === 'profile' ? 'Saving your profile…' : 'Uploading and saving your photo…'}</p>}
            {saveError && <p className="field-error" role="alert">{saveError}</p>}
            {message && <div className="profile-success"><p role="status">{message}</p><button type="button" onClick={() => setMessage('')} aria-label="Dismiss success message">×</button></div>}
          </div>
          {isOwn && editing && <form className="profile-editor" onSubmit={handleSave}>
            <h2>Edit Profile</h2>
            <label htmlFor="profile-name-input">Display name</label>
            <input id="profile-name-input" required maxLength={100} value={name} disabled={Boolean(busy)} onChange={(event) => setName(event.target.value)} />
            <label htmlFor="profile-bio-input">Bio</label>
            <textarea id="profile-bio-input" maxLength={300} rows={3} value={bio} disabled={Boolean(busy)} onChange={(event) => setBio(event.target.value)} />
            <small>{bio.length}/300 characters</small>
            <div className="profile-editor-actions">
              <button type="submit" className="primary-button" disabled={Boolean(busy)}>{busy === 'profile' ? 'Saving…' : 'Save changes'}</button>
              <button type="button" className="post-action" disabled={Boolean(busy)} onClick={() => { setEditing(false); setSaveError('') }}>Cancel</button>
            </div>
          </form>}
          <ProfileConnections profileId={profileId} user={user} />
          {/* These buttons switch real content without leaving the profile. */}
          <nav className="profile-tabs" aria-label="Profile sections">
            {['posts', 'about'].map((item) => <button type="button" key={item} className={tab === item ? 'profile-tab-active' : ''} aria-pressed={tab === item} onClick={() => setTab(item)}>{item === 'posts' ? 'Posts' : 'About'}</button>)}
          </nav>
        </section>
        <div className={`profile-content ${tab === 'about' ? 'profile-about-only' : ''}`}>
          {aboutCard()}
          <section className="post-list" aria-labelledby="my-posts-title" hidden={tab !== 'posts'}>
            <h2 id="my-posts-title">{isOwn ? 'My Posts' : `${displayName}’s Posts`}</h2>
            {posts.length === 0 ? <div className="profile-empty"><h3>{isOwn ? 'Your story starts here' : 'No posts yet'}</h3><p>{isOwn ? 'You have not shared a post yet.' : 'This member has not shared any posts yet.'}</p>{isOwn && <button type="button" className="primary-button" onClick={() => onNavigate('home')}>Go to feed</button>}</div>
              : posts.map((post) => <PostCard key={post.id} post={post} user={user} currentProfile={profile} />)}
          </section>
        </div>
      </>}
      {/* Upload controls stay outside the photo buttons, so clicks do not mix. */}
      <dialog ref={photoDialog} className="profile-photo-dialog" aria-label={viewer?.label || 'Photo viewer'} onClose={() => { if (!photoDialog.current.open) setViewer(null) }} onKeyDown={(event) => {
        // The close button is the viewer's only keyboard control.
        if (event.key === 'Tab') {
          event.preventDefault()
          event.currentTarget.querySelector('button').focus()
        }
      }} onClick={(event) => {
        if (event.target === event.currentTarget) photoDialog.current.close()
      }}>
        <button type="button" className="photo-viewer-close" aria-label="Close photo viewer" onClick={() => photoDialog.current.close()}>×</button>
        {viewer && (viewerError ? <p role="alert">This photo could not load. Close the viewer and try again.</p> : <img src={viewer.src} alt={viewer.label} onError={() => setViewerError(true)} />)}
      </dialog>
    </main>
  )
}
export default Profile
