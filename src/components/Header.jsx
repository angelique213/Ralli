import ralliLogo from '../assets/ralli-logo.png'

function Header() {
  return (
    <header className="site-header">
      <div className="container header-brand">
        <img className="header-logo" src={ralliLogo} alt="Ralli" width={108} height={108} />
        {/* Shows the main navigation. Future pages stay disabled. */}
        <nav className="main-nav" aria-label="Main navigation">
          <span className="nav-item nav-active" aria-current="page">Home</span>
          {['Explore', 'Challenges', 'Profile'].map((name) => (
            <button key={name} type="button" className="nav-item" disabled>
              {name}<span className="nav-note">Coming soon</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}

export default Header
