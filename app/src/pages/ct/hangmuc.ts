import { supabase } from '../../lib/supabase'
import { useDuLieu } from '../../lib/dulieu'
import { so, tong } from '../../lib/tinh'

export type HangMuc = {
  id: string; stt: string; thu_tu: number; ten: string; dvt: string
  khoi_luong_hd: number; don_gia_hd: number; thanh_tien_hd: number; khoi_luong_hoan_thanh: number
  version: number; updated_at: string | null; updated_by: string | null
}
export const useHangMuc = (ct: string) => useDuLieu<HangMuc[]>(
  () => supabase.from('hang_muc_hop_dong').select('*').eq('cong_trinh_id', ct).order('thu_tu').order('stt') as never, [ct], ['hang_muc_hop_dong'], 'cache-hm-' + ct)

/** Tổng hợp từ dữ liệu gốc: giá trị hạng mục theo hợp đồng, giá trị đã thực hiện, số hạng mục đạt 100% */
export function tongHopHangMuc(ds: HangMuc[], giaTriHopDong: number) {
  const gtHangMuc = tong(ds.map((h) => so(h.khoi_luong_hd) * so(h.don_gia_hd)))
  const gtThucHien = tong(ds.map((h) => so(h.khoi_luong_hoan_thanh) * so(h.don_gia_hd)))
  const mau = giaTriHopDong > 0 ? giaTriHopDong : gtHangMuc
  return { gtHangMuc, gtThucHien, mau, tyLe: mau > 0 ? (gtThucHien / mau) * 100 : 0, soHoanThanh: ds.filter((h) => so(h.khoi_luong_hoan_thanh) >= so(h.khoi_luong_hd)).length }
}
export const tyLeHM = (h: HangMuc) => (so(h.khoi_luong_hd) > 0 ? (so(h.khoi_luong_hoan_thanh) / so(h.khoi_luong_hd)) * 100 : 0)
