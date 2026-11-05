import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useDuLieu } from '../../lib/dulieu'
import { fmtSo, fmtTien, so, tong } from '../../lib/tinh'
import { Dang, Huy, Modal, Nut, The, TieuDe, Rong } from '../../components/ui'
import { CotNhom, MAU_BD, Tron } from '../../components/Bieudo'
import { xuatExcel } from '../../lib/excel'
import DsPhieuVT, { type Loc } from './DsPhieu'
import { useVatTu } from './NhapVT'

type TH = { vat_tu_id: string; ten: string; dvt: string; khoi_luong_dt: number; kl_thuc_te: number; kl_con_lai: number; kl_vuot: number; gia_tri_tong: number; gia_tri_co_hd: number; gia_tri_khong_hd: number; kl_co_hd: number; kl_khong_hd: number; canh_bao: 'ok' | 'dat' | 'vuot' }
type Thang = { thang: string; gia_tri_tong: number; gia_tri_co_hd: number; gia_tri_khong_hd: number }

export default function THVT({ ct }: { ct: string }) {
  const vt = useVatTu(ct)
  const q = useDuLieu<TH[]>(() => supabase.from('v_tong_hop_vat_tu').select('*').eq('cong_trinh_id', ct).order('ten') as never, [ct], ['phieu_nhap_vt', 'vat_tu_mau'], 'cache-thvt-' + ct)
  const th = useDuLieu<Thang[]>(() => supabase.from('v_vat_tu_theo_thang').select('*').eq('cong_trinh_id', ct).order('thang') as never, [ct], ['phieu_nhap_vt'], 'cache-thvt-thang-' + ct)
  const [chiTiet, setChiTiet] = useState<{ tieuDe: string; loc: Loc } | null>(null)
  if (q.dangTai) return <Dang />
  const ds = q.data ?? []
  if (!ds.length) return <Rong t="Chưa có vật tư mẫu hoặc chưa nhập vật tư." />
  const T = (k: keyof TH) => tong(ds.map((x) => so(x[k])))
  const bd = ds.map((x) => ({ ...x, ten: x.ten, dt: so(x.khoi_luong_dt), tt: so(x.kl_thuc_te), con: Math.max(so(x.kl_con_lai), 0), vuot: so(x.kl_vuot), vtId: x.vat_tu_id }))
  const mo = (tieuDe: string, loc: Loc) => setChiTiet({ tieuDe, loc })
  return (
    <div className="space-y-4">
      <TieuDe phai={<Nut mau="phu" className="min-h-10 px-3 text-sm" onClick={() => xuatExcel('tong-hop-vat-tu', 'Tổng hợp vật tư', [{
        ten: 'Tổng hợp vật tư',
        cot: [{ tieuDe: 'Tên vật tư', khoa: 'ten', rong: 28 }, { tieuDe: 'ĐVT', khoa: 'dvt', rong: 8 }, { tieuDe: 'KL dự toán', khoa: 'dt', dinhDang: 'so' }, { tieuDe: 'KL thực tế', khoa: 'tt', dinhDang: 'so' }, { tieuDe: 'KL còn lại', khoa: 'con', dinhDang: 'so' }, { tieuDe: 'KL vượt', khoa: 'vuot', dinhDang: 'so' },
          { tieuDe: 'KL có HĐ', khoa: 'klhd', dinhDang: 'so' }, { tieuDe: 'KL không HĐ', khoa: 'klkhd', dinhDang: 'so' }, { tieuDe: 'Tổng giá trị', khoa: 'gt', dinhDang: 'tien' }, { tieuDe: 'Giá trị có HĐ', khoa: 'gthd', dinhDang: 'tien' }, { tieuDe: 'Giá trị không HĐ', khoa: 'gtkhd', dinhDang: 'tien' }],
        dong: ds.map((x) => ({ ten: x.ten, dvt: x.dvt, dt: so(x.khoi_luong_dt), tt: so(x.kl_thuc_te), con: so(x.kl_con_lai), vuot: so(x.kl_vuot), klhd: so(x.kl_co_hd), klkhd: so(x.kl_khong_hd), gt: so(x.gia_tri_tong), gthd: so(x.gia_tri_co_hd), gtkhd: so(x.gia_tri_khong_hd) })),
        tongDong: { ten: 'TỔNG', gt: T('gia_tri_tong'), gthd: T('gia_tri_co_hd'), gtkhd: T('gia_tri_khong_hd') },
      }, { ten: 'Theo tháng', cot: [{ tieuDe: 'Tháng', khoa: 'thang' }, { tieuDe: 'Tổng giá trị', khoa: 'a', dinhDang: 'tien' }, { tieuDe: 'Có hóa đơn', khoa: 'b', dinhDang: 'tien' }, { tieuDe: 'Không hóa đơn', khoa: 'c', dinhDang: 'tien' }],
        dong: (th.data ?? []).map((x) => ({ thang: x.thang, a: so(x.gia_tri_tong), b: so(x.gia_tri_co_hd), c: so(x.gia_tri_khong_hd) })) }])}>⬇ Excel</Nut>}>Tổng hợp vật tư</TieuDe>

      <div className="grid grid-cols-2 gap-3">
        <The><div className="text-sm text-slate-500">Tổng giá trị vật tư</div><div className="text-xl font-bold num">{fmtTien(T('gia_tri_tong'))}</div></The>
        <button className="text-left" onClick={() => mo('Phiếu CÓ hóa đơn', { coHD: true })}><The className="h-full ring-green-300"><div className="text-sm text-slate-500">Giá trị có hóa đơn · KL {fmtSo(T('kl_co_hd'))}</div><div className="text-xl font-bold text-ok num">{fmtTien(T('gia_tri_co_hd'))}</div></The></button>
        <button className="text-left" onClick={() => mo('Phiếu KHÔNG có hóa đơn', { coHD: false })}><The className="h-full ring-amber-300"><div className="text-sm text-slate-500">Giá trị không hóa đơn · KL {fmtSo(T('kl_khong_hd'))}</div><div className="text-xl font-bold text-warn num">{fmtTien(T('gia_tri_khong_hd'))}</div></The></button>
        <The><div className="text-sm text-slate-500">Vật tư vượt / đạt dự toán</div><div className="text-xl font-bold num"><span className="text-bad">{ds.filter((x) => x.canh_bao === 'vuot').length}</span> / <span className="text-warn">{ds.filter((x) => x.canh_bao === 'dat').length}</span></div></The>
      </div>

      <The>
        <h3 className="mb-2 font-bold text-brand">Chi tiết từng vật tư (bấm dòng để xem phiếu)</h3>
        <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm num">
          <thead><tr className="border-b text-left text-slate-500"><th className="p-1">Vật tư</th><th>ĐVT</th><th className="text-right">Dự toán</th><th className="text-right">Thực tế</th><th className="text-right">Còn lại</th><th className="text-right">Vượt</th><th className="text-right">Tổng GT</th><th className="text-right">GT có HĐ</th><th className="text-right">GT không HĐ</th></tr></thead>
          <tbody>{ds.map((x) => (
            <tr key={x.vat_tu_id} onClick={() => mo(x.ten, { vatTuId: x.vat_tu_id })} className={`cursor-pointer border-b active:bg-slate-100 ${x.canh_bao === 'vuot' ? 'bg-red-50' : x.canh_bao === 'dat' ? 'bg-amber-50' : ''}`}>
              <td className="p-1 font-semibold">{x.ten} {x.canh_bao !== 'ok' && <Huy loai={x.canh_bao}>{x.canh_bao === 'vuot' ? 'VƯỢT' : 'ĐẠT'}</Huy>}</td><td>{x.dvt}</td>
              <td className="text-right">{fmtSo(x.khoi_luong_dt)}</td><td className="text-right">{fmtSo(x.kl_thuc_te)}</td><td className="text-right">{fmtSo(x.kl_con_lai)}</td><td className="text-right font-semibold text-bad">{so(x.kl_vuot) ? fmtSo(x.kl_vuot) : ''}</td>
              <td className="text-right">{fmtTien(x.gia_tri_tong)}</td><td className="text-right">{fmtTien(x.gia_tri_co_hd)}</td><td className="text-right">{fmtTien(x.gia_tri_khong_hd)}</td></tr>))}
          </tbody>
          <tfoot><tr className="font-bold"><td className="p-1" colSpan={6}>TỔNG</td><td className="text-right">{fmtTien(T('gia_tri_tong'))}</td><td className="text-right">{fmtTien(T('gia_tri_co_hd'))}</td><td className="text-right">{fmtTien(T('gia_tri_khong_hd'))}</td></tr></tfoot>
        </table></div>
      </The>

      <The><h3 className="mb-1 font-bold text-brand">So sánh khối lượng thực tế với dự toán</h3>
        <CotNhom du_lieu={bd} chuoi={[{ khoa: 'dt', ten: 'Dự toán', mau: MAU_BD.xam }, { khoa: 'tt', ten: 'Thực tế', mau: MAU_BD.xanh }]} tien={false} chon={(h) => mo(String(h.ten), { vatTuId: String(h.vtId) })} /></The>
      <The><h3 className="mb-1 font-bold text-brand">Vật tư còn lại và vượt dự toán</h3>
        <CotNhom du_lieu={bd} xepChong tien={false} chuoi={[{ khoa: 'con', ten: 'Còn lại', mau: MAU_BD.luc }, { khoa: 'vuot', ten: 'Vượt dự toán', mau: MAU_BD.do }]} chon={(h) => mo(String(h.ten), { vatTuId: String(h.vtId) })} /></The>
      <The><h3 className="mb-1 font-bold text-brand">Giá trị có hóa đơn / không hóa đơn</h3>
        <Tron chon={(k) => mo(k === 'hd' ? 'Phiếu CÓ hóa đơn' : 'Phiếu KHÔNG có hóa đơn', { coHD: k === 'hd' })} du_lieu={[{ ten: 'Có hóa đơn', gia_tri: T('gia_tri_co_hd'), mau: MAU_BD.luc, khoa: 'hd' }, { ten: 'Không hóa đơn', gia_tri: T('gia_tri_khong_hd'), mau: MAU_BD.cam, khoa: 'khd' }]} /></The>
      <The><h3 className="mb-1 font-bold text-brand">Giá trị vật tư theo tháng (bấm cột để xem phiếu)</h3>
        <CotNhom x="thang" du_lieu={(th.data ?? []).map((x) => ({ ...x, a: so(x.gia_tri_co_hd), b: so(x.gia_tri_khong_hd) }))} xepChong chuoi={[{ khoa: 'a', ten: 'Có hóa đơn', mau: MAU_BD.luc }, { khoa: 'b', ten: 'Không hóa đơn', mau: MAU_BD.cam }]}
          chon={(h, k) => { const t = String(h.thang); const [y, m] = t.split('-').map(Number); const cuoi = new Date(y, m, 0).getDate(); mo(`Phiếu tháng ${m}/${y}`, { tu: `${t}-01`, den: `${t}-${String(cuoi).padStart(2, '0')}`, coHD: k === 'a' }) }} /></The>

      {chiTiet && <Modal tieuDe={chiTiet.tieuDe} dong={() => setChiTiet(null)}><DsPhieuVT ct={ct} vatTu={vt.data ?? []} loc={chiTiet.loc} goc tieuDeXuat="chi-tiet-phieu" /></Modal>}
    </div>
  )
}
