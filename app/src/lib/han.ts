import { homNay, soNgayConLai } from './tinh'

type CT = { ngay_hoan_thanh_dk?: string | null; ngay_ky_bb_ban_giao?: string | null; trang_thai?: string; luu_tru?: boolean }
/** Tình trạng thời hạn hợp đồng. null = không cần theo dõi (đã bàn giao / hoàn thành / lưu trữ / chưa có ngày). */
export function hanHopDong(c: CT, hom: string = homNay()): { ngay: number; loai: 'ok' | 'dat' | 'vuot'; chu: string } | null {
  if (!c.ngay_hoan_thanh_dk || c.ngay_ky_bb_ban_giao || c.trang_thai === 'hoan_thanh' || c.luu_tru) return null
  const n = soNgayConLai(c.ngay_hoan_thanh_dk, hom)
  if (n < 0) return { ngay: n, loai: 'vuot', chu: `QUÁ HẠN ${-n} NGÀY` }
  if (n === 0) return { ngay: 0, loai: 'vuot', chu: 'HẾT HẠN HÔM NAY' }
  return { ngay: n, loai: n <= 3 ? 'vuot' : n <= 10 ? 'dat' : 'ok', chu: `CÒN ${n} NGÀY` }
}
