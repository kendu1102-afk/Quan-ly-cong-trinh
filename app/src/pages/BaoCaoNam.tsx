import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useDuLieu } from '../lib/dulieu'
import { useCT } from '../lib/ct'
import { fmtTien, so, tong, TRANG_THAI } from '../lib/tinh'
import { Dang, Huy, Nut, Rong, The, TieuDe, o } from '../components/ui'
import { CotNhom, Gantt, MAU_BD } from '../components/Bieudo'
import { xuatExcel } from '../lib/excel'

type TQ = { cong_trinh_id: string; ten: string; nam: number; trang_thai: string; gia_tri_hop_dong: number; ngay_khoi_cong: string | null; ngay_hoan_thanh_dk: string | null
  vt_tong: number; vt_co_hd: number; vt_khong_hd: number; cp_tong: number; cp_co_hd: number; cp_hdkv: number; cp_khong_ct: number }
type Thang = { cong_trinh_id: string; thang: string; tong: number; co_hoa_don: number; hdkv: number; khong_chung_tu: number }

export default function BaoCaoNam() {
  const { ds } = useCT()
  const namNay = new Date().getFullYear()
  const [nam, setNam] = useState(namNay)
  const q = useDuLieu<TQ[]>(() => supabase.from('v_tong_quan_cong_trinh').select('*') as never, [], ['phieu_nhap_vt', 'chi_phi', 'cong_trinh'], 'cache-bc')
  const th = useDuLieu<Thang[]>(() => supabase.from('v_chi_phi_theo_thang').select('*') as never, [], ['chi_phi'], 'cache-bc-thang')
  const nams = useMemo(() => [...new Set([namNay, ...ds.map((c) => c.nam)])].sort((a, b) => b - a), [ds, namNay])
  const hang = (q.data ?? []).filter((x) => x.nam === nam).sort((a, b) => a.ten.localeCompare(b.ten))
  const ids = new Set(hang.map((h) => h.cong_trinh_id))
  const theoThang = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const k = `${nam}-${String(i + 1).padStart(2, '0')}`
    const r = (th.data ?? []).filter((x) => x.thang === k && ids.has(x.cong_trinh_id))
    return { thang: `T${i + 1}`, a: tong(r.map((x) => so(x.co_hoa_don))), b: tong(r.map((x) => so(x.hdkv))), c: tong(r.map((x) => so(x.khong_chung_tu))) }
  }), [th.data, nam, q.data]) // eslint-disable-line react-hooks/exhaustive-deps
  if (q.dangTai) return <Dang />
  const S = (k: keyof TQ) => tong(hang.map((h) => so(h[k])))
  const rut = (s: string) => (s.length > 14 ? s.slice(0, 13) + '…' : s)
  const bd = hang.map((h) => ({ ten: rut(h.ten), hd: so(h.gia_tri_hop_dong), vt: so(h.vt_tong), vthd: so(h.vt_co_hd), vtkhd: so(h.vt_khong_hd), cp: so(h.cp_tong) }))
  return (
    <div className="space-y-4">
      <TieuDe phai={<Nut mau="phu" className="min-h-10 px-3 text-sm" disabled={!hang.length} onClick={() => xuatExcel(`bao-cao-nam-${nam}`, `Báo cáo tổng hợp các công trình năm ${nam}`, [{
        ten: `Năm ${nam}`,
        cot: [{ tieuDe: 'STT', khoa: 'stt', rong: 6 }, { tieuDe: 'Tên công trình', khoa: 'ten', rong: 32 }, { tieuDe: 'Giá trị hợp đồng', khoa: 'hd', dinhDang: 'tien' }, { tieuDe: 'Tổng vật tư', khoa: 'vt', dinhDang: 'tien' }, { tieuDe: 'VT có hóa đơn', khoa: 'vthd', dinhDang: 'tien' }, { tieuDe: 'VT không hóa đơn', khoa: 'vtkhd', dinhDang: 'tien' },
          { tieuDe: 'Tổng chi phí', khoa: 'cp', dinhDang: 'tien' }, { tieuDe: 'CP có HĐ/CT', khoa: 'cphd', dinhDang: 'tien' }, { tieuDe: 'CP HĐKV', khoa: 'cphdkv', dinhDang: 'tien' }, { tieuDe: 'CP không CT', khoa: 'cpkct', dinhDang: 'tien' }, { tieuDe: 'Tình trạng', khoa: 'tt', rong: 16 }],
        dong: hang.map((h, i) => ({ stt: i + 1, ten: h.ten, hd: so(h.gia_tri_hop_dong), vt: so(h.vt_tong), vthd: so(h.vt_co_hd), vtkhd: so(h.vt_khong_hd), cp: so(h.cp_tong), cphd: so(h.cp_co_hd), cphdkv: so(h.cp_hdkv), cpkct: so(h.cp_khong_ct), tt: TRANG_THAI[h.trang_thai] })),
        tongDong: { ten: 'TỔNG', hd: S('gia_tri_hop_dong'), vt: S('vt_tong'), vthd: S('vt_co_hd'), vtkhd: S('vt_khong_hd'), cp: S('cp_tong'), cphd: S('cp_co_hd'), cphdkv: S('cp_hdkv'), cpkct: S('cp_khong_ct') },
      }, { ten: 'Chi phí theo tháng', cot: [{ tieuDe: 'Tháng', khoa: 'thang' }, { tieuDe: 'Có HĐ/CT', khoa: 'a', dinhDang: 'tien' }, { tieuDe: 'HĐKV', khoa: 'b', dinhDang: 'tien' }, { tieuDe: 'Không CT', khoa: 'c', dinhDang: 'tien' }], dong: theoThang }])}>⬇ Excel</Nut>}>Báo cáo theo năm</TieuDe>
      <select className={o} value={nam} onChange={(e) => setNam(Number(e.target.value))}>{nams.map((n) => <option key={n} value={n}>Năm {n}</option>)}</select>
      {!hang.length ? <Rong t={`Năm ${nam} chưa có công trình nào (xem “Năm thực hiện” của công trình).`} /> : <>
        <The><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm num">
          <thead><tr className="border-b text-left text-slate-500"><th className="p-1">STT</th><th>Công trình</th><th className="text-right">Giá trị HĐ</th><th className="text-right">Tổng VT</th><th className="text-right">VT có HĐ</th><th className="text-right">VT không HĐ</th><th className="text-right">Tổng CP</th><th className="text-right">CP có HĐ/CT</th><th className="text-right">CP HĐKV</th><th className="text-right">CP không CT</th><th>Tình trạng</th></tr></thead>
          <tbody>{hang.map((h, i) => <tr key={h.cong_trinh_id} className="border-b"><td className="p-1">{i + 1}</td><td className="font-semibold">{h.ten}</td><td className="text-right">{fmtTien(h.gia_tri_hop_dong)}</td><td className="text-right">{fmtTien(h.vt_tong)}</td><td className="text-right">{fmtTien(h.vt_co_hd)}</td><td className="text-right">{fmtTien(h.vt_khong_hd)}</td><td className="text-right">{fmtTien(h.cp_tong)}</td><td className="text-right">{fmtTien(h.cp_co_hd)}</td><td className="text-right">{fmtTien(h.cp_hdkv)}</td><td className="text-right">{fmtTien(h.cp_khong_ct)}</td><td><Huy loai={h.trang_thai === 'hoan_thanh' ? 'ok' : h.trang_thai === 'tam_dung' ? 'xam' : 'xanh'}>{TRANG_THAI[h.trang_thai]}</Huy></td></tr>)}</tbody>
          <tfoot><tr className="font-bold"><td colSpan={2} className="p-1">TỔNG</td><td className="text-right">{fmtTien(S('gia_tri_hop_dong'))}</td><td className="text-right">{fmtTien(S('vt_tong'))}</td><td className="text-right">{fmtTien(S('vt_co_hd'))}</td><td className="text-right">{fmtTien(S('vt_khong_hd'))}</td><td className="text-right">{fmtTien(S('cp_tong'))}</td><td className="text-right">{fmtTien(S('cp_co_hd'))}</td><td className="text-right">{fmtTien(S('cp_hdkv'))}</td><td className="text-right">{fmtTien(S('cp_khong_ct'))}</td><td /></tr></tfoot>
        </table></div></The>
        <The><h3 className="mb-1 font-bold text-brand">Giá trị hợp đồng</h3><CotNhom du_lieu={bd} chuoi={[{ khoa: 'hd', ten: 'Hợp đồng', mau: MAU_BD.xanh }]} /></The>
        <The><h3 className="mb-1 font-bold text-brand">Tổng giá trị vật tư</h3><CotNhom du_lieu={bd} chuoi={[{ khoa: 'vt', ten: 'Vật tư', mau: MAU_BD.tim }]} /></The>
        <The><h3 className="mb-1 font-bold text-brand">Vật tư có hóa đơn và không có hóa đơn</h3><CotNhom du_lieu={bd} xepChong chuoi={[{ khoa: 'vthd', ten: 'Có hóa đơn', mau: MAU_BD.luc }, { khoa: 'vtkhd', ten: 'Không hóa đơn', mau: MAU_BD.cam }]} /></The>
        <The><h3 className="mb-1 font-bold text-brand">Tổng chi phí</h3><CotNhom du_lieu={bd} chuoi={[{ khoa: 'cp', ten: 'Chi phí', mau: MAU_BD.do }]} /></The>
        <The><h3 className="mb-1 font-bold text-brand">Chi phí theo tháng (tất cả công trình trong năm)</h3><CotNhom x="thang" du_lieu={theoThang} xepChong chuoi={[{ khoa: 'a', ten: 'Có HĐ/CT', mau: MAU_BD.luc }, { khoa: 'b', ten: 'HĐKV', mau: MAU_BD.cam }, { khoa: 'c', ten: 'Không CT', mau: MAU_BD.do }]} /></The>
        <The><h3 className="mb-2 font-bold text-brand">Tiến độ công trình (Gantt)</h3><Gantt nam={nam} hang={hang.map((h) => ({ ten: h.ten, tu: h.ngay_khoi_cong, den: h.ngay_hoan_thanh_dk, trang_thai: h.trang_thai }))} /></The>
      </>}
    </div>
  )
}
