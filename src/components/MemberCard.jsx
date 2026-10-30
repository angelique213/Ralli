import { Link } from 'react-router'
import { profilePath } from '../services/connections.js'
import Avatar from './Avatar.jsx'
import ConnectButton from './ConnectButton.jsx'


function MemberCard({ person, user }) {
  const path = profilePath(person.id, user.id)
  const name = person.display_name?.trim() || 'Ralli Member'
  return <article className="member-card" aria-label={`Member ${name}`}>
    <Link to={path} className="member-identity"><Avatar profile={person} /><h3>{name}</h3></Link>
    {person.bio && <p className="member-bio">{person.bio}</p>}
    <div className="member-actions"><Link to={path} className="post-action">View Profile</Link><ConnectButton user={user} targetId={person.id} /></div>
  </article>
}
export default MemberCard
