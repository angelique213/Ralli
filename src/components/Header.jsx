import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import ralliLogo from '../assets/ralli-logo.png'

function Header({ page, onNavigate, user, onLogout, loggingOut }) {
  const accountMenu = useRef(null)

  function closeAccountMenu() {
    if (accountMenu.current) accountMenu.current.open = false
  }

  useEffect(() => {
    function dismiss(event) {
      if (!accountMenu.current?.contains(event.target)) closeAccountMenu()
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])

  return (
    <header className="site-header">
      <div className="container header-brand">
        <img className="header-logo" src={ralliLogo} alt="Ralli" width={108} height={108} />
        {/* Shows the main navigation. */}
        <nav className="main-nav" aria-label="Main navigation">
          <button
            type="button"
            className={`nav-item ${page === 'home' ? 'nav-active' : ''}`}
            aria-current={page === 'home' ? 'page' : undefined}
            onClick={() => onNavigate('home')}
          >Home</button>
          <button type="button" className={`nav-item ${page === 'explore' ? 'nav-active' : ''}`} aria-current={page === 'explore' ? 'page' : undefined} onClick={() => onNavigate('explore')}>Explore</button>
          <button type="button" className={`nav-item ${page === 'challenges' ? 'nav-active' : ''}`} aria-current={page === 'challenges' ? 'page' : undefined} onClick={() => onNavigate('challenges')}>Challenges</button>
          <button
            type="button"
            className={`nav-item ${page === 'profile' ? 'nav-active' : ''}`}
            aria-current={page === 'profile' ? 'page' : undefined}
            onClick={() => onNavigate('profile')}
          >Profile</button>
          <button type="button" className={`nav-item ${page === 'messages' ? 'nav-active' : ''}`} aria-current={page === 'messages' ? 'page' : undefined} onClick={() => onNavigate('messages')}>Messages</button>
        </nav>
        <div className="auth-navigation" aria-label="Account pages">
          {user ? <>
          <button type="button" className="post-action desktop-account-action" onClick={onLogout} disabled={loggingOut}>{loggingOut ? 'Logging out…' : 'Logout'}</button>
          {/* Native disclosure supports Enter, Space, and Tab without custom menu roles. */}
          <details ref={accountMenu} className="mobile-account-menu" onKeyDown={(event) => {
            if (event.key === 'Escape') { closeAccountMenu(); accountMenu.current.querySelector('summary').focus() }
          }} onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) closeAccountMenu()
          }}>
            <summary aria-label="Account options"><span aria-hidden="true">•••</span></summary>
            <div className="account-dropdown">
              <Link to="/profile?edit=true" onClick={closeAccountMenu}>Edit Profile</Link>
              <button type="button" onClick={() => { closeAccountMenu(); onLogout() }} disabled={loggingOut}>{loggingOut ? 'Logging out…' : 'Logout'}</button>
            </div>
          </details>
          </> : <>
          <button type="button" className="post-action" aria-current={page === 'login' ? 'page' : undefined} onClick={() => onNavigate('login')}>Login</button>
          <button type="button" className="primary-button" aria-current={page === 'signup' ? 'page' : undefined} onClick={() => onNavigate('signup')}>Sign Up</button>
          </>}
        </div>
      </div>
    </header>
  )
}

export default Header
