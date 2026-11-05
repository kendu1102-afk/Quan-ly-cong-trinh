import { useCallback, useEffect, useRef, useState } from 'react'
import { get, set } from 'idb-keyval'
import { supabase } from './supabase'
import { SU_KIEN } from './hangdoi'

/** Tải dữ liệu, tự tải lại khi: có thay đổi realtime ở các bảng chỉ định, có mạng trở lại, đã đồng bộ hàng đợi.
 *  `cache`: khóa lưu bản sao trên máy để vẫn xem được khi mất mạng. */
export function useDuLieu<T>(fn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>, deps: unknown[], bang: string[] = [], cache?: string) {
  const [data, setData] = useState<T | null>(null)
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState('')
  const [cu, setCu] = useState(false)
  const fnRef = useRef(fn); fnRef.current = fn
  const seq = useRef(0)

  const tai = useCallback(async () => {
    const n = ++seq.current
    const r = await fnRef.current()
    if (n !== seq.current) return
    if (r.error) {
      setLoi(r.error.message)
      if (cache) { const c = await get(cache); if (c !== undefined) { setData(c as T); setCu(true) } }
    } else { setData(r.data); setLoi(''); setCu(false); if (cache) set(cache, r.data) }
    setDangTai(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache])

  useEffect(() => { setDangTai(true); tai() }, [tai, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const lenLich = () => { clearTimeout(t); t = setTimeout(tai, 350) }
    const ten = 'rt-' + Math.random().toString(36).slice(2)
    let ch = supabase.channel(ten)
    for (const b of bang) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: b }, lenLich)
    if (bang.length) ch.subscribe()
    window.addEventListener('online', lenLich)
    window.addEventListener('du-lieu-doi', lenLich)
    window.addEventListener(SU_KIEN, lenLich)
    return () => {
      clearTimeout(t); supabase.removeChannel(ch)
      window.removeEventListener('online', lenLich); window.removeEventListener('du-lieu-doi', lenLich); window.removeEventListener(SU_KIEN, lenLich)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tai, bang.join(',')])

  return { data, dangTai, loi, cu, tai }
}
