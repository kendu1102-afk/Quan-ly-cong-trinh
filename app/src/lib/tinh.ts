// Các công thức bắt buộc. Số liệu tổng hợp thật được tính trong CSDL (view); các hàm này dùng để
// hiển thị tức thì trên form và được kiểm thử độc lập.
export const thanhTien = (kl: number, dg: number) => Math.round(kl * dg * 1e5) / 1e5
export const conLai = (dt: number, tt: number) => dt - tt
export const vuot = (dt: number, tt: number) => Math.max(tt - dt, 0)
export type CanhBao = 'ok' | 'dat' | 'vuot'
export const canhBao = (dt: number, tt: number): CanhBao => (tt > dt ? 'vuot' : tt > 0 && tt === dt ? 'dat' : 'ok')
export const tong = (a: number[]) => a.reduce((s, x) => s + x, 0)

export const so = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v))
const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 })
export const fmtSo = (v: unknown) => nf.format(so(v))
export const fmtTien = (v: unknown) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(so(v)))
export const fmtNgay = (d?: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '')
export const fmtGio = (t?: string | null) =>
  t ? new Date(t).toLocaleString('vi-VN', { hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
export const homNay = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10) }
export const dauThang = (d = homNay()) => d.slice(0, 8) + '01'
export const dauTuan = (d = homNay()) => {
  const x = new Date(d + 'T00:00:00'); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k)
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10)
}
export const uuid = () => crypto.randomUUID()
/** Chuyển "1.234,5" hoặc "1234.5" (người dùng gõ) thành số */
export const docSo = (s: string): number => {
  const t = s.trim().replace(/\s/g, '')
  if (!t) return NaN
  if (t.includes(',') && t.includes('.')) return Number(t.replace(/\./g, '').replace(',', '.'))
  if (t.includes(',')) return Number(t.replace(',', '.'))
  if ((t.match(/\./g) || []).length > 1) return Number(t.replace(/\./g, ''))
  return Number(t)
}
export const CHUNG_TU: Record<string, string> = {
  co_hoa_don: 'Có hóa đơn/chứng từ', hdkv: 'HĐKV', khong_chung_tu: 'Không chứng từ',
}
export const TRANG_THAI: Record<string, string> = {
  dang_thuc_hien: 'Đang thực hiện', tam_dung: 'Tạm dừng', hoan_thanh: 'Hoàn thành',
}
