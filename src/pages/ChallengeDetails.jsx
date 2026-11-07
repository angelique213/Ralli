import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import ChallengeForm from '../components/ChallengeForm.jsx'
import ChallengeParticipation from '../components/ChallengeParticipation.jsx'
import { ChallengeCreator } from '../components/ChallengeCard.jsx'
import { challengeError, getChallenge, setDayComplete } from '../services/challenges.js'

function Details({ user, id }) {
  const [challenge, setChallenge] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [message, setMessage] = useState('')
  const [dayPage, setDayPage] = useState(0)
  const saving = useRef(false)
  useEffect(() => {
    let active = true
    getChallenge(id, user.id).then((data) => { if (active) setChallenge(data) })
      .catch((problem) => { if (active) setError(challengeError(problem)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, user.id, retry])
  async function refresh() { setChallenge(await getChallenge(id, user.id)) }
  async function toggleDay(day) {
    if (saving.current || busy || saveError) return
    saving.current = true
    setBusy(true)
    setMessage('')
    try {
      await setDayComplete(id, user.id, day, !challenge.activity.days.includes(day))
      await refresh()
      setMessage('Progress saved.')
    } catch (problem) { setSaveError(challengeError(problem)) }
    finally { saving.current = false; setBusy(false) }
  }
  function retryLoad() { setLoading(true); setError(''); setSaveError(''); setRetry((value) => value + 1) }
  if (loading) return <p role="status">Loading challenge…</p>
  if (error) return <section role="alert"><p className="field-error">{error}</p><button className="post-action" onClick={retryLoad}>Retry challenge</button></section>
  if (!challenge) return <section className="challenge-card"><h1>Challenge not found</h1><p>This challenge may no longer be available.</p></section>
  const completed = challenge.activity.days.length
  const total = challenge.duration_days
  const percent = Math.floor(completed / total * 100)
  const firstDay = dayPage * 28 + 1
  return <>
    <section className="challenge-card challenge-detail-header">
      <span className="challenge-category">{challenge.category}</span><h1>{challenge.title}</h1><p className="challenge-body">{challenge.description}</p>
      <ChallengeCreator challenge={challenge} user={user} />
      <p className="challenge-meta">{total} {total === 1 ? 'day' : 'days'} · {challenge.activity.participantCount} {challenge.activity.participantCount === 1 ? 'participant' : 'participants'}</p>
      <h2>Your daily goal</h2><p className="challenge-body">{challenge.daily_goal}</p>
      <div className="challenge-actions"><ChallengeParticipation challenge={challenge} user={user} onChanged={refresh} disabled={busy} onBusyChange={setBusy} />{challenge.creator_id === user.id && <button className="post-action" onClick={() => { setEditing(!editing); setMessage('') }}>{editing ? 'Close editor' : 'Edit Challenge'}</button>}</div>
    </section>
    {editing && challenge.creator_id === user.id && <ChallengeForm challenge={challenge} user={user} onCancel={() => setEditing(false)} onSaved={(saved) => { setChallenge((current) => ({ ...saved, activity: current.activity })); setEditing(false); setMessage('Challenge updated.') }} />}
    {message && <p role="status">{message}</p>}
    {challenge.activity.joined && <section className="challenge-card challenge-tracker" aria-labelledby="progress-heading">
      <h2 id="progress-heading">{completed === total ? 'Challenge Completed!' : 'Your progress'}</h2>
      <p>{completed} of {total} days completed · {percent}%</p><progress max={total} value={completed} aria-label="Challenge progress" />
      <p>Complete the days at your own pace. Select a completed day again to undo it.</p>
      {busy && <p role="status">Saving progress…</p>}
      {saveError && <div role="alert"><p className="field-error">{saveError} Reload saved progress before trying again.</p><button className="post-action" onClick={retryLoad}>Reload progress</button></div>}
      {/* Show at most 28 days at once, even for a year-long challenge. */}
      <div className="challenge-days">{Array.from({ length: Math.min(28, total - firstDay + 1) }, (_, index) => firstDay + index).map((day) => <button key={day} className={`post-action ${challenge.activity.days.includes(day) ? 'day-complete' : ''}`} aria-pressed={challenge.activity.days.includes(day)} disabled={busy || Boolean(saveError)} onClick={() => toggleDay(day)}>Day {day}{challenge.activity.days.includes(day) ? ' ✓' : ''}</button>)}</div>
      {total > 28 && <div className="people-pagination"><button className="post-action" disabled={dayPage === 0} onClick={() => setDayPage((value) => value - 1)}>Earlier days</button><span>Days {firstDay}–{Math.min(firstDay + 27, total)}</span><button className="post-action" disabled={firstDay + 27 >= total} onClick={() => setDayPage((value) => value + 1)}>Later days</button></div>}
    </section>}
  </>
}
function ChallengeDetails({ user }) {
  const { challengeId } = useParams()
  const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(challengeId)
  return <main className="container challenges-page challenge-details"><Link className="back-button" to="/challenges">
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14" /></svg>
    <span>Back to Challenges</span>
  </Link>{valid ? <Details key={`${user.id}:${challengeId}`} id={challengeId} user={user} /> : <h1>Challenge not found</h1>}</main>
}
export default ChallengeDetails
