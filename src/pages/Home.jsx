import PostCard from '../components/PostCard.jsx'

// Sample posts stay in this file until we add real data later.
const samplePosts = [
  {
    id: 1,
    displayName: 'Maya Chen',
    username: 'mayamakes',
    timestamp: '10 min ago',
    text: 'Small win today: finished my first 5K! Taking it one step at a time really does add up. What is one thing you are proud of this week?',
  },
  {
    id: 2,
    displayName: 'Jordan Ellis',
    username: 'jordanexplores',
    timestamp: '35 min ago',
    text: 'Trying a little challenge: spend 20 minutes outside every day this week. Today was a walk around campus with a friend. A pretty good place to start.',
  },
  {
    id: 3,
    displayName: 'Alex Rivera',
    username: 'alexcreates',
    timestamp: '1 hour ago',
    text: 'Made time to sketch between classes today. It is nice to create something just for fun. Here is your reminder to make a little room for what you enjoy.',
  },
]

function Home() {
  return (
    <main className="container home feed">
      <div className="feed-intro">
        <p className="eyebrow">A place to connect</p>
        <h1>Your Ralli feed</h1>
        <p className="welcome-text">Small moments. Shared progress. Find your people.</p>
      </div>

      <section className="create-post" aria-labelledby="create-post-title">
        <h2 id="create-post-title">Create Post</h2>
        <label htmlFor="post-text">What would you like to share?</label>
        <textarea id="post-text" rows={4} placeholder="Share a moment, a small win, or a new idea…" />
        <div className="composer-footer">
          <p>UI prototype — posts, likes, and comments are not saved yet.</p>
          {/* No save action is connected to this button yet. */}
          <button type="button" className="primary-button">Post</button>
        </div>
      </section>

      <section className="post-list" aria-labelledby="feed-title">
        <h2 id="feed-title">Around the community</h2>
        {/* Each sample becomes a card. The ID gives React a stable key. */}
        {samplePosts.map((post) => (
          <PostCard
            key={post.id}
            displayName={post.displayName}
            username={post.username}
            timestamp={post.timestamp}
            text={post.text}
          />
        ))}
      </section>
    </main>
  )
}

export default Home
