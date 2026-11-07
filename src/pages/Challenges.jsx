import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import ChallengeCard from '../components/ChallengeCard.jsx'
import { challengeError, listChallenges } from '../services/challenges.js'

function Challenges({ user }) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(0)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  function reload() { setLoading(true); setError(''); setRetry((value) => value + 1) }
  useEffect(() => {
    let active = true
    // Ignore older searches when the user changes the text or tab.
    const timer = setTimeout(() => {
      listChallenges(user.id, search, tab, page).then((data) => { if (active) setResult(data) })
        .catch((problem) => { if (active) setError(challengeError(problem)) })
        .finally(() => { if (active) setLoading(false) })
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [user.id, search, tab, page, retry])
  return <main className="container challenges-page">
    <div className="challenge-page-heading"><div><p className="eyebrow">Small steps, shared motivation</p><h1>Discover Challenges</h1><p className="welcome-text">Take on new goals, stay motivated, and grow together.</p></div><Link className="primary-button" to="/challenges/new">Create Challenge</Link></div>
    <form className="people-search" onSubmit={(event) => { event.preventDefault(); reload() }}>
      <label htmlFor="challenge-search">Search by title</label><div><input id="challenge-search" type="search" maxLength={100} placeholder="Search challenges..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); reload() }} /><button type="submit" className="primary-button">Search</button></div>
    </form>
    <nav className="challenge-tabs" aria-label="Challenge filters">{[['all', 'All Challenges'], ['joined', 'My Challenges'], ['created', 'Created by Me']].map(([value, label]) => <button key={value} className={`post-action ${tab === value ? 'connected-button' : ''}`} aria-pressed={tab === value} onClick={() => { setTab(value); setPage(0); reload() }}>{label}</button>)}</nav>
    {loading ? <p role="status">Loading challenges…</p> : error ? <div className="challenge-card" role="alert"><p className="field-error">{error}</p><button className="post-action" onClick={reload}>Retry challenges</button></div> : <>
      {result?.challenges.length ? <div className="challenge-grid">{result.challenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} user={user} onChanged={reload} />)}</div> : <section className="challenge-card"><h2>{tab === 'joined' ? 'Your next goal is waiting' : 'No challenges here yet'}</h2><p>{search ? 'Try another title or clear your search.' : tab === 'joined' ? 'Join a challenge from All Challenges to track it here.' : 'Start something encouraging for the Ralli community.'}</p><Link className="primary-button" to="/challenges/new">Create Challenge</Link></section>}
      <div className="people-pagination"><button className="post-action" disabled={page === 0} onClick={() => { setPage((value) => value - 1); reload() }}>Previous</button><span>Page {page + 1}</span><button className="post-action" disabled={!result?.hasMore} onClick={() => { setPage((value) => value + 1); reload() }}>Next</button></div>
    </>}
  </main>
}
export default Challenges
