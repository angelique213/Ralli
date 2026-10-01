// Home is the first page visitors see.
function Home() {
  return (
    <main className="container home">
      <section className="welcome-card" aria-labelledby="welcome-title">
        <p className="eyebrow">A place to connect</p>
        <h1 id="welcome-title">Welcome to Ralli</h1>
        <p className="welcome-text">
          Share everyday moments, connect with others, and take on challenges
          together.
        </p>
        <p className="coming-soon">Our community is coming soon. This is just the beginning!</p>
      </section>
    </main>
  )
}

export default Home
