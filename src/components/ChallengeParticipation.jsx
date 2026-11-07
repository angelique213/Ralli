import { useRef, useState } from 'react'
import { challengeError, setParticipation } from '../services/challenges.js'

function ChallengeParticipation({ challenge, user, onChanged, disabled = false, onBusyChange, compact = false }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const saving = useRef(false)
  async function change() {
    if (saving.current || disabled) return
    if (challenge.activity.joined && !window.confirm('Leave this challenge? All your saved days will be removed. Joining again starts at zero.')) return
    saving.current = true
    setBusy(true)
    onBusyChange?.(true)
    setError('')
    try {
      await setParticipation(challenge.id, user.id, !challenge.activity.joined)
      await onChanged()
    } catch (problem) {
      setError(challengeError(problem))
      setUncertain(true)
    } finally { saving.current = false; setBusy(false); onBusyChange?.(false) }
  }
  return <div className="challenge-participation">
    <button type="button" className={compact && challenge.activity.joined ? 'challenge-leave-button' : challenge.activity.joined ? 'post-action connected-button' : 'primary-button'} disabled={disabled || busy || uncertain} onClick={change}>
      {busy ? 'Saving…' : challenge.activity.joined ? (compact ? 'Leave' : 'Joined · Leave Challenge') : 'Join Challenge'}
    </button>
    {error && <p role="alert" className="field-error">{error} Refresh the page to check your saved membership before trying again.</p>}
  </div>
}
export default ChallengeParticipation
