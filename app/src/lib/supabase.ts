import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const cauHinhDu = Boolean(url && key)
export const supabase = createClient(url || 'http://localhost', key || 'none', {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 10 } },
})
export const TEN_MIEN_NOI_BO = 'qlct.example'
export const taoEmail = (s: string) => (s.includes('@') ? s.trim() : `${s.trim().toLowerCase()}@${TEN_MIEN_NOI_BO}`)
