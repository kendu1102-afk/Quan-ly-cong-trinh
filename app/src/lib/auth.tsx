import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { dongBo } from './hangdoi'

export type HoSo = { id: string; email: string | null; ho_ten: string; vai_tro: 'admin' | 'ketoan'; bi_khoa: boolean }
type Ctx = {
  session: Session | null; ho: HoSo | null; dangTai: boolean; isAdmin: boolean
  nguoi: Record<string, string>; thoat: () => Promise<void>; taiLaiNguoi: () => Promise<void>
}
const C = createContext<Ctx>(null as never)
export const useAuth = () => useContext(C)
const CACHE = 'ho-so-cache'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ho, setHo] = useState<HoSo | null>(null)
  const [dangTai, setDangTai] = useState(true)
  const [nguoi, setNguoi] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setDangTai(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const taiLaiNguoi = async () => {
    const { data } = await supabase.from('profiles').select('id,ho_ten,email')
    if (data) setNguoi(Object.fromEntries(data.map((p) => [p.id, p.ho_ten || p.email || '?'])))
  }

  useEffect(() => {
    if (!session) { setHo(null); return }
    let huy = false
    ;(async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (huy) return
      if (data) {
        if (data.bi_khoa) { await supabase.auth.signOut(); localStorage.removeItem(CACHE); alert('Tài khoản đã bị khóa. Liên hệ Admin.'); return }
        setHo(data as HoSo); localStorage.setItem(CACHE, JSON.stringify(data))
        taiLaiNguoi()
      } else if (error) {
        const c = localStorage.getItem(CACHE) // mất mạng: dùng hồ sơ đã lưu
        if (c) { const h = JSON.parse(c) as HoSo; if (h.id === session.user.id) setHo(h) }
      }
      setDangTai(false)
    })()
    return () => { huy = true }
  }, [session])

  // Tự đồng bộ hàng đợi khi có mạng / khi mở ứng dụng
  useEffect(() => {
    if (!session) return
    const chay = () => { if (navigator.onLine) dongBo(session.user.id) }
    chay()
    window.addEventListener('online', chay)
    const t = setInterval(chay, 30000)
    return () => { window.removeEventListener('online', chay); clearInterval(t) }
  }, [session])

  const v = useMemo<Ctx>(() => ({
    session, ho, dangTai, isAdmin: ho?.vai_tro === 'admin', nguoi, taiLaiNguoi,
    thoat: async () => { localStorage.removeItem(CACHE); await supabase.auth.signOut() },
  }), [session, ho, dangTai, nguoi])
  return <C.Provider value={v}>{children}</C.Provider>
}
