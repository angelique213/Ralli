import { Link } from 'react-router'
import Avatar from './Avatar.jsx'
import ChallengeParticipation from './ChallengeParticipation.jsx'
import { profilePath } from '../services/connections.js'

export function ChallengeCreator({ challenge, user, showLabel = false }) {
  return <Link className="member-identity challenge-creator" to={profilePath(challenge.creator_id, user.id)}>
    <Avatar profile={challenge.creator} small /><span className="challenge-creator-info"><strong>{challenge.creator?.display_name?.trim() || 'Ralli Member'}</strong>{showLabel && <small>Challenge creator</small>}</span>
  </Link>
}

function ChallengeCard({ challenge, user, onChanged }) {
  const completed = challenge.activity.days.length
  const percent = Math.floor(completed / challenge.duration_days * 100)
  return <article className="challenge-card challenge-feed-card">
    <div className="challenge-card-top"><ChallengeCreator challenge={challenge} user={user} showLabel /><span className="challenge-category">{challenge.category}</span></div>
    <h2><Link to={`/challenges/${challenge.id}`}>{challenge.title}</Link></h2>
    <p className="challenge-card-description">{challenge.description}</p>
    <div className="challenge-card-meta"><span>{challenge.duration_days} {challenge.duration_days === 1 ? 'day' : 'days'}</span><span>{challenge.activity.participantCount} {challenge.activity.participantCount === 1 ? 'participant' : 'participants'}</span></div>
    {challenge.activity.joined && <div className="challenge-summary">
      <progress aria-label={`${challenge.title} progress`} max={challenge.duration_days} value={completed} />
      <p>{completed} of {challenge.duration_days} days completed · {percent}%</p>
      <span className="challenge-progress-status">{completed === challenge.duration_days ? 'Completed' : 'In Progress'}</span>
    </div>}
    {/* Continue is the main action; leaving still asks before removing progress. */}
    <div className="challenge-actions challenge-card-actions">
      {challenge.activity.joined ? <>
        <Link className="primary-button" to={`/challenges/${challenge.id}`}>Continue Challenge</Link>
        <ChallengeParticipation challenge={challenge} user={user} onChanged={onChanged} compact />
      </> : <>
        <ChallengeParticipation challenge={challenge} user={user} onChanged={onChanged} compact />
        <Link className="challenge-details-link" to={`/challenges/${challenge.id}`}>View Details</Link>
      </>}
    </div>
  </article>
}
export default ChallengeCard
