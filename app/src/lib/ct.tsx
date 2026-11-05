import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useDuLieu } from './dulieu'
import { useAuth } from './auth'

export type CongTrinh = {
  id: string; ten: string; chu_dau_tu: string; dia_diem: string; gia_tri_hop_dong: number
  ngay_khoi_cong: string | null; ngay_hoan_thanh_dk: string | null; nam: number; ghi_chu: string
  trang_thai: 'dang_thuc_hien' | 'tam_dung' | 'hoan_thanh'; luu_tru: boolean; version: number
}
type C = { ds: CongTrinh[]; dangTai: boolean; cur: string | null; chon: (id: string) => void; hienTai?: CongTrinh; tai: () => void }
const Ctx = createContext<C>(null as never)
export const useCT = () => useContext(Ctx)

export function CTProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [cur, setCur] = useState<string | null>(localStorage.getItem('ct-hien-tai'))
  const { data, dangTai, tai } = useDuLieu<CongTrinh[]>(
    () => session ? supabase.from('cong_trinh').select('*').order('nam', { ascending: false }).order('ten') as never : Promise.resolve({ data: [], error: null }),
    [session?.user.id], ['cong_trinh', 'phan_quyen'], 'cache-ct-' + (session?.user.id ?? ''),
  )
  const ds = data ?? []
  const v = useMemo<C>(() => {
    const hop = ds.find((x) => x.id === cur) ?? ds.find((x) => !x.luu_tru) ?? ds[0]
    return { ds, dangTai, cur: hop?.id ?? null, hienTai: hop, tai, chon: (id) => { localStorage.setItem('ct-hien-tai', id); setCur(id) } }
  }, [data, dangTai, cur]) // eslint-disable-line react-hooks/exhaustive-deps
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>
}
