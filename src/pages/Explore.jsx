import { useEffect, useState } from 'react'
import MemberCard from '../components/MemberCard.jsx'
import { searchPeople } from '../services/connections.js'

function Explore({ user }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    // Wait briefly while typing, and ignore responses for older searches.
    const timer = setTimeout(() => {
      searchPeople(user.id, search, page).then((data) => { if (active) setResult(data) })
        .catch((problem) => { if (active) setError(problem.message || 'Could not search members.') })
        .finally(() => { if (active) setLoading(false) })
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [user.id, search, page, retry])

  function reload() { setLoading(true); setError(''); setRetry((value) => value + 1) }
  return <main className="container explore-page">
    <p className="eyebrow">Find your people</p><h1>Explore Ralli</h1><p className="welcome-text">Meet members, share encouragement, and make a connection.</p>
    <form className="people-search" onSubmit={(event) => { event.preventDefault(); reload() }}>
      <label htmlFor="people-search">Search members</label>
      <div><input id="people-search" type="search" maxLength={100} placeholder="Search people by name..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); setLoading(true); setError('') }} /><button className="primary-button" type="submit">Search</button></div>
    </form>
    {loading ? <p role="status">Finding members…</p> : error ? <div role="alert"><p>{error}</p><button className="post-action" onClick={reload}>Retry search</button></div> : <>
      {result?.people.length ? <div className="people-grid">{result.people.map((person) => <MemberCard key={person.id} person={person} user={user} />)}</div> : <p className="profile-empty">No members found. Try another name.</p>}
      <div className="people-pagination"><button className="post-action" disabled={page === 0} onClick={() => { setPage((value) => value - 1); setLoading(true) }}>Previous</button><span>Page {page + 1}</span><button className="post-action" disabled={!result?.hasMore} onClick={() => { setPage((value) => value + 1); setLoading(true) }}>Next</button></div>
    </>}
  </main>
}
export default Explore
