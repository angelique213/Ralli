import { Navigate, useParams, Link } from 'react-router'
import Profile from './Profile.jsx'

function PublicProfile({ user, onNavigate }) {
  const params = useParams()
  const userId = params.userId.toLowerCase()
  if (userId === user.id) return <Navigate to="/profile" replace />
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return <main className="container home"><h1>Profile not found</h1><p>This profile link is not valid.</p><Link to="/explore">Find Ralli members</Link></main>
  }
  // A different target remounts the page so old account data cannot flash.
  return <Profile key={userId} user={user} profileId={userId} onNavigate={onNavigate} />
}
export default PublicProfile
