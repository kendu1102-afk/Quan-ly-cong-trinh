import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useDuLieu } from '../lib/dulieu'
import { fmtSo } from '../lib/tinh'
import { thongBao, thongBaoHeThong } from '../lib/thongbao'
import { useAuth } from '../lib/auth'

export type CBRow = { vat_tu_id: string; cong_trinh_id: string; ten: string; dvt: string; khoi_luong_dt: number; kl_thuc_te: number; kl_con_lai: number; kl_vuot: number; canh_bao: 'dat' | 'vuot' }
export const useCanhBao = () => useDuLieu<CBRow[]>(() => supabase.from('v_canh_bao_vat_tu').select('*') as never, [], ['phieu_nhap_vt', 'vat_tu_mau'], 'cache-canh-bao')

/** Theo dõi cảnh báo theo thời gian thực: khi có vật tư mới đạt/vượt dự toán (do bất kỳ ai nhập) thì báo ngay */
export default function CanhBaoWatcher() {
  const { session } = useAuth()
  const { data } = useCanhBao()
  const truoc = useRef<Map<string, string> | null>(null)
  useEffect(() => {
    if (!data) return
    const nay = new Map(data.map((r) => [r.vat_tu_id, `${r.canh_bao}:${r.kl_thuc_te}`]))
    if (truoc.current && session) {
      for (const r of data) {
        if (truoc.current.get(r.vat_tu_id) !== nay.get(r.vat_tu_id)) {
          const noi = `${r.ten}: dự toán ${fmtSo(r.khoi_luong_dt)} ${r.dvt}, đã nhập ${fmtSo(r.kl_thuc_te)} — ${r.canh_bao === 'vuot' ? 'VƯỢT ' + fmtSo(r.kl_vuot) : 'ĐÃ ĐẠT dự toán (còn 0)'}`
          thongBao('⚠ ' + noi, 'canhbao'); thongBaoHeThong(r.canh_bao === 'vuot' ? 'Vật tư VƯỢT dự toán' : 'Vật tư đạt dự toán', noi)
        }
      }
    }
    truoc.current = nay
  }, [data, session])
  return null
}
