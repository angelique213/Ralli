import { useEffect, useState } from 'react'
import { connectionError, getConnectionCounts, getConnectionPeople } from '../services/connections.js'
import { useConnections } from './connectionsContext.js'
import MemberCard from './MemberCard.jsx'

function ConnectionList({ profileId, direction, user }) {
  const { revision } = useConnections()
  const [page, setPage] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    getConnectionPeople(profileId, direction, page).then((data) => { if (active) { setResult(data); setError('') } })
      .catch((problem) => { if (active) setError(connectionError(problem)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [profileId, direction, page, revision, retry])
  return <section className="connection-list" aria-label={direction === 'connections' ? 'Connections list' : 'Connected By list'}>
    <h2>{direction === 'connections' ? 'Connections' : 'Connected By'}</h2>
    {loading ? <p role="status">Loading members…</p> : error ? <div role="alert"><p>{error}</p><button className="post-action" onClick={() => { setLoading(true); setRetry((value) => value + 1) }}>Retry list</button></div> : <>
      {result?.people.length ? <div className="people-grid">{result.people.map((person) => <MemberCard key={person.id} person={person} user={user} />)}</div> : <p>No connections on this page yet.</p>}
      <div className="people-pagination"><button className="post-action" disabled={!page} onClick={() => { setPage((value) => value - 1); setLoading(true) }}>Previous</button><span>Page {page + 1}</span><button className="post-action" disabled={!result?.hasMore} onClick={() => { setPage((value) => value + 1); setLoading(true) }}>Next</button></div>
    </>}
  </section>
}

function ProfileConnections({ profileId, user }) {
  const { revision } = useConnections()
  const [counts, setCounts] = useState(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [direction, setDirection] = useState(null)
  useEffect(() => {
    let active = true
    getConnectionCounts(profileId).then((data) => { if (active) { setCounts(data); setError('') } })
      .catch((problem) => { if (active) setError(connectionError(problem)) })
    return () => { active = false }
  }, [profileId, revision, retry])
  return <div className="profile-connections">
    {error ? <div role="alert"><p className="field-error">{error}</p><button className="text-button" onClick={() => setRetry((value) => value + 1)}>Retry counts</button></div> : counts ? <div className="connection-counts">
      <button className="post-action" aria-expanded={direction === 'connections'} onClick={() => setDirection(direction === 'connections' ? null : 'connections')}>Connections: {counts.connections}</button>
      <button className="post-action" aria-expanded={direction === 'connectedBy'} onClick={() => setDirection(direction === 'connectedBy' ? null : 'connectedBy')}>Connected By: {counts.connectedBy}</button>
    </div> : <p role="status">Loading connections…</p>}
    {direction && <><button className="text-button" onClick={() => setDirection(null)}>Close connection list</button><ConnectionList key={direction} profileId={profileId} direction={direction} user={user} /></>}
  </div>
}
export default ProfileConnections
