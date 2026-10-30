import { useEffect, useRef, useState } from 'react'
import { connectionError, isConnected, saveConnection } from '../services/connections.js'
import { useConnections } from './connectionsContext.js'

function ConnectButton({ user, targetId }) {
  const { revision, refreshConnections } = useConnections()
  const [connected, setConnected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const saving = useRef(false)

  useEffect(() => {
    if (user.id === targetId) return
    let active = true
    isConnected(user.id, targetId).then((value) => { if (active) { setConnected(value); setError('') } })
      .catch((problem) => { if (active) { setConnected(null); setError(connectionError(problem)) } })
    return () => { active = false }
  }, [user.id, targetId, revision, retry])

  async function toggle() {
    if (saving.current || connected === null || user.id === targetId) return
    saving.current = true
    setBusy(true)
    setError('')
    try {
      await saveConnection(user.id, targetId, connected)
      refreshConnections()
      setConnected(await isConnected(user.id, targetId))
    } catch (problem) {
      setConnected(null)
      setError(`${connectionError(problem)} Retry to check the saved state before trying again.`)
    } finally { saving.current = false; setBusy(false) }
  }

  if (user.id === targetId) return null
  return <div className="connect-control">
    <button type="button" className={connected ? 'post-action connected-button' : 'primary-button'} aria-pressed={Boolean(connected)} disabled={busy || connected === null} onClick={toggle}>
      {busy ? 'Saving…' : connected === null ? 'Checking connection…' : connected ? 'Connected' : 'Connect'}
    </button>
    {error && <div role="alert" className="field-error"><p>{error}</p><button type="button" className="text-button" disabled={busy} onClick={() => { setError(''); setRetry((value) => value + 1) }}>Retry connection</button></div>}
  </div>
}
export default ConnectButton
