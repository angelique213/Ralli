import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router'
import Header from './components/Header.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import SignUp from './pages/SignUp.jsx'
import { supabase, authConfigured } from './services/supabase.js'

function App() {
  const navigate = useNavigate()

  // Existing buttons now change the URL instead of temporary page state.
  function navigateToPage(page) {
    const paths = { home: '/', login: '/login', signup: '/signup' }
    navigate(paths[page], { replace: page === 'home' })
  }
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(authConfigured)
  const [authError, setAuthError] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('error_description') || '')
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let active = true
    let authChanged = false
    // Reports expired or invalid email confirmation links.
    const params = new URLSearchParams(window.location.hash.slice(1))
    const linkError = params.get('error_description')
    if (linkError) {
      window.history.replaceState(null, '', window.location.pathname)
    }
    // Supabase restores its session and reports login/logout changes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      authChanged = true
      setSession(nextSession)
      setLoading(false)
    })
    // Restores the saved session without overwriting a newer login/logout event.
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active || authChanged) return
      if (error) {
        setSession(null)
        setAuthError(error.message)
      } else {
        setSession(data.session)
      }
      setLoading(false)
    }).catch(() => {
      if (active && !authChanged) {
        setSession(null)
        setAuthError('Could not restore your session. Please refresh and try again.')
        setLoading(false)
      }
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    setAuthError('')
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
      setSession(null)
      navigate('/login', { replace: true })
    } catch (error) {
      setAuthError(error.message || 'Could not log out. Please try again.')
    } finally {
      setLoggingOut(false)
    }
  }

  const user = session?.user
  // Wait before choosing a page so a restored session does not flash a form.
  if (loggingOut) return <p className="container" role="status">Logging out…</p>
  if (loading) return <p className="container" role="status">Restoring your session…</p>

  return (
    <>
      {!authConfigured && <p className="container field-error" role="alert">Add your Supabase URL and publishable key to .env, then restart Vite.</p>}
      {authError && <p className="container field-error" role="alert">{authError}</p>}
      <Routes>
        {/* Never mount the private feed without a Supabase session. */}
        <Route path="/" element={user ? (
          <>
            <Header page="home" onNavigate={navigateToPage} user={user} onLogout={handleLogout} loggingOut={loggingOut} />
            <Home key={user.id} user={user} onNavigate={navigateToPage} />
          </>
        ) : <Navigate to="/login" replace />} />
        {/* Signed-in users go Home instead of seeing another login form. */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onNavigate={navigateToPage} />} />
        <Route path="/signup" element={user ? <Navigate to="/" replace /> : <SignUp onNavigate={navigateToPage} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
