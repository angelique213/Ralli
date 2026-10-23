import ralliLogo from '../assets/ralli-logo.png'

function Header({ page, onNavigate, user, onLogout, loggingOut }) {
  return (
    <header className="site-header">
      <div className="container header-brand">
        <img className="header-logo" src={ralliLogo} alt="Ralli" width={108} height={108} />
        {/* Shows the main navigation. Future pages stay disabled. */}
        <nav className="main-nav" aria-label="Main navigation">
          <button
            type="button"
            className={`nav-item ${page === 'home' ? 'nav-active' : ''}`}
            aria-current={page === 'home' ? 'page' : undefined}
            onClick={() => onNavigate('home')}
          >Home</button>
          {['Explore', 'Challenges', 'Profile'].map((name) => (
            <button key={name} type="button" className="nav-item" disabled>
              {name}<span className="nav-note">Coming soon</span>
            </button>
          ))}
        </nav>
        <div className="auth-navigation" aria-label="Account pages">
          {user ? <button type="button" className="post-action" onClick={onLogout} disabled={loggingOut}>{loggingOut ? 'Logging out…' : 'Logout'}</button> : <>
          <button type="button" className="post-action" aria-current={page === 'login' ? 'page' : undefined} onClick={() => onNavigate('login')}>Login</button>
          <button type="button" className="primary-button" aria-current={page === 'signup' ? 'page' : undefined} onClick={() => onNavigate('signup')}>Sign Up</button>
          </>}
        </div>
      </div>
    </header>
  )
}

export default Header
