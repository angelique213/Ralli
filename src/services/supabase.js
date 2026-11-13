import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
// Prefer the new key name, but support deployments using the legacy name.
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

function isPublicKey(value) {
  if (value?.startsWith('sb_publishable_')) return true
  try {
    // This checks the legacy key type, not its signature; Supabase validates it.
    const parts = value.split('.')
    if (parts.length !== 3) return false
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload)).role === 'anon'
  } catch {
    return false
  }
}

// Only a public browser key belongs here, never a secret or service-role key.
export const authConfigured = Boolean(url?.startsWith('https://') && isPublicKey(key))
export const supabase = authConfigured ? createClient(url, key) : null
