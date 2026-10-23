import { useState } from 'react'
import { supabase } from '../services/supabase.js'
import ralliLogo from '../assets/logo-transparent.png'
import welcomeBackground from '../assets/background.png'
import friendsIllustration from '../assets/ralli-friends.png'

// Both pages share the same form styles and validation rules.
function AuthForm({ mode, onNavigate }) {
  const isSignUp = mode === 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  // Changes password visibility without changing its value.
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy) return
    setMessage('')
    setAuthError('')
    // Checks the inputs before contacting Supabase.
    const nextErrors = {}
    if (isSignUp && !name.trim()) nextErrors.name = 'Enter your name.'
    if (!email.trim()) nextErrors.email = 'Enter your email.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Enter a valid email, such as student@example.com.'
    }
    if (!password.trim()) nextErrors.password = 'Enter a password.'
    if (isSignUp) {
      if (!confirmPassword.trim()) nextErrors.confirmPassword = 'Confirm your password.'
      else if (password !== confirmPassword) nextErrors.confirmPassword = 'Passwords must match.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    if (!supabase) {
      setAuthError('Supabase is not configured. Check your local .env file.')
      return
    }
    setBusy(true)
    try {
      // Sends credentials directly to Supabase Auth over HTTPS.
      const { data, error } = isSignUp
        ? await supabase.auth.signUp({
            email: email.trim(), password,
            options: {
              data: { display_name: name.trim() },
              emailRedirectTo: window.location.origin,
            },
          })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      if (data.session) onNavigate('home')
      else setMessage('Check your email for a confirmation link before logging in. If you already registered, try Login. No session is active yet.')
      setPassword('')
      setConfirmPassword('')
    } catch (error) {
      setAuthError(error.message || 'Authentication failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-welcome" style={{ backgroundImage: `url(${welcomeBackground})` }}>
      <div className="container auth-welcome-layout">
      {/* Keeps the artwork beside the text without covering it. */}
      <section className="welcome-branding" aria-labelledby="welcome-heading">
        <img className="welcome-logo" src={ralliLogo} alt="Ralli" width={2172} height={724} />
        <h2 id="welcome-heading">Connect. Share.<br /><span>Grow together.</span></h2>
        <p className="welcome-description">Share your moments, support friends, and take on fun challenges together.</p>
        <ul className="welcome-features">
          <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>Share</li>
          <li><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="7" r="3" /><path d="M3 20v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M18 13a5 5 0 0 1 3 5v2" /></svg>Connect</li>
          <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v5a5 5 0 0 1-10 0ZM7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4M12 13v7M7 21h10" /></svg>Challenge</li>
        </ul>
        <div className="welcome-artwork">
        {/* These challenge cards are decoration, not real progress. */}
        <div className="welcome-decorations" aria-hidden="true">
          <div className="welcome-mini-card"><span>👟</span><strong>10,000 steps</strong><div className="decoration-bars"><i /><i /><i /></div></div>
          <div className="welcome-mini-card"><span>🔥</span><strong>Stay active</strong><div className="decoration-bars"><i /><i /><i /></div></div>
        </div>
        <img className="welcome-friends" src={friendsIllustration} alt="Four friends smiling and taking a selfie together" width={1536} height={1024} />
        </div>
      </section>
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">Your community starts here</p>
        <h1 id="auth-title">{isSignUp ? 'Join the Ralli community!' : 'Welcome back!'}</h1>
        <p className="auth-notice">{isSignUp ? 'Create your Ralli account. You may need to confirm your email before logging in.' : 'Log in to your Ralli account'}</p>
        {/* React shows field errors instead of the browser's default messages. */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {isSignUp && (
            <div>
              <label htmlFor="auth-name">Name</label>
              <input id="auth-name" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} />
              {errors.name && <p id="name-error" className="field-error">{errors.name}</p>}
            </div>
          )}
          <div>
            <label htmlFor="auth-email">Email</label>
            <div className="auth-icon-field">
            <svg className="auth-field-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
            <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} />
            </div>
            {errors.email && <p id="email-error" className="field-error">{errors.email}</p>}
          </div>
          <div>
            <label htmlFor="auth-password">Password</label>
            <div className="password-control auth-icon-field">
            <svg className="auth-field-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg>
            <input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={isSignUp ? 'new-password' : 'current-password'} required value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined} />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
            </div>
            {errors.password && <p id="password-error" className="field-error">{errors.password}</p>}
          </div>
          {isSignUp && (
            <div>
              <label htmlFor="auth-confirm">Confirm password</label>
              <input id="auth-confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined} />
              {errors.confirmPassword && <p id="confirm-error" className="field-error">{errors.confirmPassword}</p>}
            </div>
          )}
          {!isSignUp && <div className="password-help"><button type="button" disabled>Forgot password?</button><span>Password reset is not available yet.</span></div>}
          {Object.keys(errors).length > 0 && <p role="alert" className="field-error">Please fix the fields marked above.</p>}
          <button type="submit" className="primary-button" disabled={busy || !supabase}>{busy ? 'Please wait…' : isSignUp ? 'Create account' : 'Log In'}</button>
          {authError && <p role="alert" className="field-error">{authError}</p>}
          <p role="status" className="auth-status">{message}</p>
        </form>
        <div className="auth-divider"><span>or</span></div>
        <div className="auth-links">
          <button type="button" className="auth-switch" onClick={() => onNavigate(isSignUp ? 'login' : 'signup')}>
            {isSignUp ? 'Already have an account? Log In' : 'Create new account'}
          </button>
          <button type="button" className="text-button" onClick={() => onNavigate('home')}>Back to Home</button>
        </div>
      </section>
      </div>
    </main>
  )
}

export default AuthForm
