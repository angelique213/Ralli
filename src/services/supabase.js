import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

// Only a public browser key belongs here, never a secret or service-role key.
export const authConfigured = Boolean(url?.startsWith('https://') && key?.startsWith('sb_publishable_'))
export const supabase = authConfigured ? createClient(url, key) : null
