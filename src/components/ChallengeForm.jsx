import { useRef, useState } from 'react'
import { categories, challengeError, saveChallenge } from '../services/challenges.js'

function ChallengeForm({ user, challenge, onSaved, onCancel }) {
  const [values, setValues] = useState(challenge || { title: '', description: '', category: '', duration_days: 7, daily_goal: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  function change(event) { setValues((current) => ({ ...current, [event.target.name]: event.target.value })) }
  async function submit(event) {
    event.preventDefault()
    if (saving.current) return
    saving.current = true
    setBusy(true)
    setError('')
    try {
      const saved = await saveChallenge(values, user.id, challenge?.id)
      onSaved(saved)
    } catch (problem) { setError(challengeError(problem)) }
    finally { saving.current = false; setBusy(false) }
  }
  return <form className="challenge-form" onSubmit={submit} aria-label={challenge ? 'Edit challenge' : 'Create challenge'}>
    <h2>{challenge ? 'Edit Challenge' : 'Create Challenge'}</h2>
    <p>Give your community a clear, achievable goal.</p>
    <fieldset disabled={busy}>
      <label htmlFor="challenge-title">Title</label>
      <input id="challenge-title" name="title" required maxLength={100} value={values.title} onChange={change} />
      <label htmlFor="challenge-description">Description</label>
      <textarea id="challenge-description" name="description" required maxLength={500} rows={3} value={values.description} onChange={change} />
      <label htmlFor="challenge-category">Category</label>
      <select id="challenge-category" name="category" required value={values.category} onChange={change}>
        <option value="">Choose a category</option>{categories.map((category) => <option key={category}>{category}</option>)}
      </select>
      <label htmlFor="challenge-duration">Duration in days</label>
      <input id="challenge-duration" name="duration_days" type="number" min={1} max={365} step={1} required disabled={Boolean(challenge)} value={values.duration_days} onChange={change} aria-describedby="duration-help" />
      <small id="duration-help">Duration stays fixed after creation to protect everyone’s progress.</small>
      <label htmlFor="challenge-goal">Daily goal or activity instructions</label>
      <textarea id="challenge-goal" name="daily_goal" required maxLength={300} rows={3} value={values.daily_goal} onChange={change} />
    </fieldset>
    {error && <p role="alert" className="field-error">{error} If your connection was interrupted, check Created by Me before submitting again.</p>}
    <div className="challenge-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : challenge ? 'Save changes' : 'Create Challenge'}</button><button className="post-action" type="button" onClick={onCancel} disabled={busy}>Cancel</button></div>
  </form>
}
export default ChallengeForm
