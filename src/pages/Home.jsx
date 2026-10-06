import { useState } from 'react'
import PostCard from '../components/PostCard.jsx'

// Sample posts stay in this file until we add real data later.
const samplePosts = [
  {
    id: 1,
    initialLikes: 4,
    displayName: 'Maya Chen',
    username: 'mayamakes',
    timestamp: '10 min ago',
    text: 'Small win today: finished my first 5K! Taking it one step at a time really does add up. What is one thing you are proud of this week?',
  },
  {
    id: 2,
    initialLikes: 2,
    displayName: 'Jordan Ellis',
    username: 'jordanexplores',
    timestamp: '35 min ago',
    text: 'Trying a little challenge: spend 20 minutes outside every day this week. Today was a walk around campus with a friend. A pretty good place to start.',
  },
  {
    id: 3,
    initialLikes: 7,
    displayName: 'Alex Rivera',
    username: 'alexcreates',
    timestamp: '1 hour ago',
    text: 'Made time to sketch between classes today. It is nice to create something just for fun. Here is your reminder to make a little room for what you enjoy.',
  },
]

function Home() {
  // Stores the text the user is typing.
  const [postText, setPostText] = useState('')
  // Starts the feed with our sample posts.
  const [posts, setPosts] = useState(samplePosts)

  function handlePost() {
    const trimmedText = postText.trim()
    // Stops empty posts, including text that is only spaces.
    if (!trimmedText) return

    const newPost = {
      id: crypto.randomUUID(),
      displayName: 'Ralli Student',
      username: 'rallistudent',
      timestamp: 'Just now',
      text: trimmedText,
      initialLikes: 0,
    }

    // Adds the new post above the existing posts.
    setPosts((currentPosts) => [newPost, ...currentPosts])
    // Clears the text box after posting.
    setPostText('')
  }

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
        <textarea
          id="post-text"
          rows={4}
          placeholder="Share a moment, a small win, or a new idea…"
          value={postText}
          onChange={(event) => setPostText(event.target.value)}
        />
        <div className="composer-footer">
          <p>Posts and likes reset when you refresh. Comments are still a preview.</p>
          <button
            type="button"
            className="primary-button"
            onClick={handlePost}
            disabled={!postText.trim()}
          >
            Post
          </button>
        </div>
      </section>

      <section className="post-list" aria-labelledby="feed-title">
        <h2 id="feed-title">Around the community</h2>
        {/* Displays each post using the same reusable card. */}
        {posts.map((post) => (
          <PostCard
            key={post.id}
            displayName={post.displayName}
            username={post.username}
            timestamp={post.timestamp}
            text={post.text}
            initialLikes={post.initialLikes}
          />
        ))}
      </section>
    </main>
  )
}

export default Home
