import { useEffect, useRef, useState } from 'react'
import { cleanDeletedPostImage } from '../services/postImages.js'

export function usePostDeletion(setPosts, userId) {
  const [notices, setNotices] = useState([])
  const inProgress = useRef(new Set())
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])

  async function retryCleanup(notice) {
    if (inProgress.current.has(notice.id)) return
    inProgress.current.add(notice.id)
    setNotices((items) => items.map((item) => item.id === notice.id ? { ...item, status: 'cleaning', error: '' } : item))
    try {
      await cleanDeletedPostImage(notice.image_path, userId)
      if (active.current) setNotices((items) => items.map((item) => item.id === notice.id ? { ...item, status: 'done' } : item))
    } catch (problem) {
      if (active.current) setNotices((items) => items.map((item) => item.id === notice.id ? { ...item, status: 'error', error: problem.message } : item))
    } finally { inProgress.current.delete(notice.id) }
  }

  function onDeleted(deleted) {
    // Keep cleanup messages outside the card so they survive its removal.
    setPosts((items) => items.filter((post) => post.id !== deleted.id))
    const notice = { ...deleted, status: deleted.image_path ? 'cleaning' : 'done' }
    setNotices((items) => [...items, notice])
    if (deleted.image_path) void retryCleanup(notice)
  }

  function dismiss(id) { setNotices((items) => items.filter((item) => item.id !== id)) }
  return { notices, onDeleted, retryCleanup, dismiss }
}
