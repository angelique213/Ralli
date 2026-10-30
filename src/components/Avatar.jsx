import { useState } from 'react'
import { profileImageUrl } from '../services/profile.js'

function Avatar({ profile, small = false }) {
  const name = profile?.display_name?.trim() || 'Ralli Member'
  const path = profile?.avatar_path
  const [failedPath, setFailedPath] = useState(null)
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const colors = ['avatar-blue', 'avatar-purple', 'avatar-coral']
  const color = colors[name.charCodeAt(0) % colors.length]

  // A new saved path gets a fresh chance to load after a photo change.
  return (
    <div className={`post-avatar author-avatar ${color} ${small ? 'comment-avatar' : ''}`}>
      {path && path !== failedPath ? (
        <img src={profileImageUrl(path)} alt={`${name}'s profile photo`} onError={() => setFailedPath(path)} />
      ) : <span aria-label={`${name}'s initials`}>{initials}</span>}
    </div>
  )
}

export default Avatar
