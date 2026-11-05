import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { CongTrinh } from '../../lib/ct'
import { docSo, fmtSo, fmtTien, so } from '../../lib/tinh'
import { Dang, Loi, Modal, Nut, Rong, The, TieuDe, Truong, o } from '../../components/ui'
import TienDoThucHien from '../../components/TienDo'
import { thongBao } from '../../lib/thongbao'
import { docHangMucExcel, mauHangMuc, xuatExcel, type DongHangMuc } from '../../lib/excel'
import { tongHopHangMuc, tyLeHM, useHangMuc, type HangMuc } from './hangmuc'

const bo = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
const loiRang = (m: string, h?: HangMuc) =>
  m.includes('hm_hoan_thanh_hop_le') ? `Khối lượng hợp đồng không được nhỏ hơn khối lượng đã hoàn thành${h ? ` (${fmtSo(h.khoi_luong_hoan_thanh)})` : ''}.` : m.includes('duplicate') ? 'STT này đã có trong công trình.' : m

export default function KLHopDong({ cong }: { cong: CongTrinh }) {
  const { isAdmin } = useAuth()
  const q = useHangMuc(cong.id)
  const [tim, setTim] = useState(''); const [sua, setSua] = useState<Partial<HangMuc> | null>(null)
  const [xem, setXem] = useState<DongHangMuc[] | null>(null)
  const file = useRef<HTMLInputElement>(null)
  if (q.dangTai) return <Dang />
  const all = q.data ?? []
  const ds = all.filter((h) => bo(`${h.stt} ${h.ten}`).includes(bo(tim)))
  const tk = tongHopHangMuc(all, so(cong.gia_tri_hop_dong))
  const stts = new Set(all.map((h) => h.stt))

  const nhap = async (f: File) => {
    try { setXem(await docHangMucExcel(f)) } catch { thongBao('Không đọc được tệp Excel (.xlsx)', 'loi') }
  }
  const xacNhan = async () => {
    const hop = xem!.filter((x) => x.loai === 'ok')
    const rows = hop.map((x) => ({ cong_trinh_id: cong.id, stt: x.stt, thu_tu: x.dong, ten: x.ten, dvt: x.dvt, khoi_luong_hd: x.khoi_luong_hd, don_gia_hd: x.don_gia_hd }))
    const { error } = await supabase.from('hang_muc_hop_dong').upsert(rows, { onConflict: 'cong_trinh_id,stt' })
    if (error) return thongBao(loiRang(error.message), 'loi')
    thongBao(`Đã nhập ${rows.length} hạng mục (khối lượng đã hoàn thành được giữ nguyên)`); setXem(null); q.tai()
  }
  const soMoi = xem ? xem.filter((x) => x.loai === 'ok' && !stts.has(x.stt)).length : 0
  const soCapNhat = xem ? xem.filter((x) => x.loai === 'ok' && stts.has(x.stt)).length : 0
  const xoa = async (h: HangMuc) => {
    if (!confirm(`Xóa hạng mục “${h.ten}”${so(h.khoi_luong_hoan_thanh) > 0 ? `\n(đã ghi nhận hoàn thành ${fmtSo(h.khoi_luong_hoan_thanh)} ${h.dvt}, sẽ mất)` : ''}?`)) return
    const { error } = await supabase.from('hang_muc_hop_dong').delete().eq('id', h.id)
    error ? thongBao(error.message, 'loi') : (thongBao('Đã xóa hạng mục'), q.tai())
  }
  const xoaTatCa = async () => {
    const t = prompt(`XÓA TOÀN BỘ ${all.length} hạng mục khối lượng hợp đồng của công trình này (kể cả khối lượng đã hoàn thành).\nNên Sao lưu trước. Gõ đúng chữ XÓA TẤT CẢ để xác nhận:`)
    if (t !== 'XÓA TẤT CẢ') return t !== null && thongBao('Chưa xóa vì gõ chưa đúng', 'loi')
    const { error } = await supabase.from('hang_muc_hop_dong').delete().eq('cong_trinh_id', cong.id)
    error ? thongBao(error.message, 'loi') : (thongBao('Đã xóa toàn bộ hạng mục'), q.tai())
  }
  return (
    <div className="space-y-3">
      <TieuDe phai={<Nut mau="phu" className="min-h-10 px-3 text-sm" onClick={() => xuatExcel('khoi-luong-hop-dong', `Khối lượng hợp đồng – ${cong.ten}`, [{
        ten: 'Khối lượng hợp đồng', cot: [{ tieuDe: 'STT', khoa: 'stt', rong: 8 }, { tieuDe: 'Tên hạng mục', khoa: 'ten', rong: 42 }, { tieuDe: 'ĐVT', khoa: 'dvt', rong: 10 }, { tieuDe: 'KL hợp đồng', khoa: 'kl', dinhDang: 'so' }, { tieuDe: 'Đơn giá', khoa: 'dg', dinhDang: 'tien' }, { tieuDe: 'Thành tiền', khoa: 'tt', dinhDang: 'tien' }, { tieuDe: 'KL đã hoàn thành', khoa: 'ht', dinhDang: 'so' }, { tieuDe: '% hoàn thành', khoa: 'pt', rong: 12 }, { tieuDe: 'Giá trị đã thực hiện', khoa: 'gt', dinhDang: 'tien' }],
        dong: all.map((h) => ({ stt: h.stt, ten: h.ten, dvt: h.dvt, kl: so(h.khoi_luong_hd), dg: so(h.don_gia_hd), tt: so(h.khoi_luong_hd) * so(h.don_gia_hd), ht: so(h.khoi_luong_hoan_thanh), pt: tyLeHM(h).toFixed(1) + '%', gt: so(h.khoi_luong_hoan_thanh) * so(h.don_gia_hd) })),
        tongDong: { ten: 'TỔNG', tt: tk.gtHangMuc, gt: tk.gtThucHien },
      }])}>⬇ Excel</Nut>}>Khối lượng hợp đồng</TieuDe>

      <div className="grid gap-3 sm:grid-cols-2">
        <TienDoThucHien gtThucHien={tk.gtThucHien} mau={tk.mau} tyLe={tk.tyLe} phu={`${tk.soHoanThanh}/${all.length} hạng mục đã hoàn thành 100%`} />
        <div className="kpi"><div className="text-sm text-slate-600">Tổng thành tiền các hạng mục theo khối lượng hợp đồng</div>
          <div className="num mt-1 text-lg font-bold text-brand">{fmtTien(tk.gtHangMuc)} đ</div>
          {so(cong.gia_tri_hop_dong) > 0 && Math.abs(tk.gtHangMuc - so(cong.gia_tri_hop_dong)) > 1 && all.length > 0 &&
            <div className="mt-1 text-xs text-warn">Khác giá trị hợp đồng ({fmtTien(cong.gia_tri_hop_dong)} đ) — thường do thuế, dự phòng… Tỷ lệ % ở bên cạnh tính theo giá trị hợp đồng.</div>}
        </div>
      </div>

      {isAdmin ? (
        <div className="flex flex-wrap gap-2">
          <Nut onClick={() => setSua({ stt: String(all.length ? Math.max(...all.map((h) => Number(h.stt) || 0)) + 1 : 1) })}>＋ Thêm hạng mục</Nut>
          <Nut mau="vang" onClick={() => file.current?.click()}>📥 Nhập từ Excel</Nut>
          <Nut mau="xam" onClick={mauHangMuc}>Tải file mẫu</Nut>
          {!!all.length && <Nut mau="do" className="ml-auto" onClick={xoaTatCa}>Xóa tất cả</Nut>}
          <input ref={file} type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) nhap(f) }} />
        </div>
      ) : <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Khối lượng hợp đồng do Admin quản lý. Kế toán cập nhật khối lượng hoàn thành ở thẻ “Khối lượng hoàn thành”.</div>}

      <input className={o} placeholder="🔍 Tìm hạng mục…" value={tim} onChange={(e) => setTim(e.target.value)} />
      {!ds.length && <Rong t={all.length ? 'Không tìm thấy' : isAdmin ? 'Chưa có hạng mục nào. Bấm “＋ Thêm hạng mục” hoặc “Nhập từ Excel”.' : 'Admin chưa nhập khối lượng hợp đồng cho công trình này.'} />}
      {!!ds.length && (
        <The><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm num">
          <thead><tr className="border-b text-left text-slate-600"><th className="p-1">STT</th><th>Hạng mục</th><th>ĐVT</th><th className="text-right">KL hợp đồng</th><th className="text-right">Đơn giá</th><th className="text-right">Thành tiền</th><th className="text-right">Đã hoàn thành</th><th className="text-right">%</th>{isAdmin && <th />}</tr></thead>
          <tbody>{ds.map((h) => (
            <tr key={h.id} className="border-b align-top">
              <td className="p-1">{h.stt}</td><td className="max-w-[18rem] font-semibold">{h.ten}</td><td>{h.dvt}</td>
              <td className="text-right">{fmtSo(h.khoi_luong_hd)}</td><td className="text-right">{fmtTien(h.don_gia_hd)}</td><td className="text-right">{fmtTien(so(h.khoi_luong_hd) * so(h.don_gia_hd))}</td>
              <td className="text-right">{fmtSo(h.khoi_luong_hoan_thanh)}</td><td className={`text-right font-semibold ${tyLeHM(h) >= 100 ? 'text-ok' : ''}`}>{tyLeHM(h).toFixed(0)}%</td>
              {isAdmin && <td className="whitespace-nowrap text-right"><button className="px-2 py-1 text-brand-2" onClick={() => setSua(h)}>Sửa</button><button className="px-2 py-1 text-bad" onClick={() => xoa(h)}>Xóa</button></td>}
            </tr>))}
          </tbody>
          <tfoot><tr className="font-bold"><td colSpan={5} className="p-1">TỔNG</td><td className="text-right">{fmtTien(tk.gtHangMuc)}</td><td colSpan={isAdmin ? 3 : 2} className="text-right">Đã thực hiện {fmtTien(tk.gtThucHien)}</td></tr></tfoot>
        </table></div></The>
      )}
      {sua && <FormHM h={sua} cong={cong.id} dong={() => setSua(null)} xong={() => { setSua(null); q.tai() }} />}
      {xem && (
        <Modal tieuDe={`Xem trước: ${xem.length} dòng`} dong={() => setXem(null)}>
          <div className="mb-2 rounded-xl bg-blue-50 p-2 text-sm text-blue-900">
            Hợp lệ: <b>{soMoi}</b> hạng mục mới · <b>{soCapNhat}</b> hạng mục trùng STT sẽ được <b>cập nhật</b> (khối lượng đã hoàn thành được giữ nguyên) · dòng nhóm và dòng lỗi bị bỏ qua.
          </div>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {xem.map((x) => (
              <div key={x.dong} className={`rounded-lg p-2 text-sm ${x.loai === 'loi' ? 'bg-red-50 text-bad' : x.loai === 'nhom' ? 'bg-slate-100 text-slate-500' : 'hang-nen'}`}>
                #{x.dong} <b>{x.stt}</b> {x.ten}{x.loai === 'ok' && <> · {x.dvt} · {fmtSo(x.khoi_luong_hd)} × {fmtTien(x.don_gia_hd)}{stts.has(x.stt) ? ' (cập nhật)' : ' (mới)'}</>}
                {x.loai === 'nhom' && ' — dòng nhóm, bỏ qua'}{x.loi && ` — ${x.loi}`}
              </div>))}
          </div>
          <Nut mau="vang" className="mt-3 w-full" disabled={!(soMoi + soCapNhat)} onClick={xacNhan}>Nhập {soMoi + soCapNhat} hạng mục hợp lệ</Nut>
        </Modal>
      )}
    </div>
  )
}

function FormHM({ h, cong, dong, xong }: { h: Partial<HangMuc>; cong: string; dong: () => void; xong: () => void }) {
  const [f, setF] = useState({ stt: h.stt ?? '', ten: h.ten ?? '', dvt: h.dvt ?? '', kl: h.khoi_luong_hd ? String(h.khoi_luong_hd) : '', dg: h.don_gia_hd ? String(h.don_gia_hd) : '' })
  const [loi, setLoi] = useState('')
  const luu = async () => {
    const kl = docSo(f.kl), dg = f.dg === '' ? 0 : docSo(f.dg)
    if (!f.stt.trim() || !f.ten.trim() || !f.dvt.trim()) return setLoi('Nhập STT, tên hạng mục và đơn vị tính')
    if (!(kl > 0)) return setLoi('Khối lượng hợp đồng phải lớn hơn 0')
    if (!(dg >= 0)) return setLoi('Đơn giá phải là số ≥ 0')
    const row = { stt: f.stt.trim(), ten: f.ten.trim(), dvt: f.dvt.trim(), khoi_luong_hd: kl, don_gia_hd: dg }
    const r = h.id ? await supabase.from('hang_muc_hop_dong').update(row, { count: 'exact' }).eq('id', h.id).eq('version', h.version!) : await supabase.from('hang_muc_hop_dong').insert({ ...row, cong_trinh_id: cong, thu_tu: Date.now() % 2000000000 })
    if (r.error) return setLoi(loiRang(r.error.message, h as HangMuc))
    if (h.id && r.count === 0) return setLoi('Hạng mục vừa được người khác sửa, hãy đóng và mở lại.')
    thongBao('Đã lưu hạng mục'); xong()
  }
  return (
    <Modal tieuDe={h.id ? 'Sửa hạng mục hợp đồng' : 'Thêm hạng mục hợp đồng'} dong={dong}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Truong nhan="STT"><input className={o} value={f.stt} onChange={(e) => setF({ ...f, stt: e.target.value })} /></Truong>
          <Truong nhan="Đơn vị tính" className="col-span-2"><input className={o} value={f.dvt} onChange={(e) => setF({ ...f, dvt: e.target.value })} placeholder="m3, m2, tấn, md…" /></Truong>
        </div>
        <Truong nhan="Tên hạng mục"><input className={o} value={f.ten} onChange={(e) => setF({ ...f, ten: e.target.value })} /></Truong>
        <div className="grid grid-cols-2 gap-3">
          <Truong nhan="Khối lượng hợp đồng"><input className={o} inputMode="decimal" value={f.kl} onChange={(e) => setF({ ...f, kl: e.target.value })} /></Truong>
          <Truong nhan="Đơn giá hợp đồng (đồng)"><input className={o} inputMode="decimal" value={f.dg} onChange={(e) => setF({ ...f, dg: e.target.value })} /></Truong>
        </div>
        <div>Thành tiền: <b className="num text-brand">{fmtTien((docSo(f.kl || '0') || 0) * (docSo(f.dg || '0') || 0))}</b> đ</div>
        <Loi t={loi} /><Nut className="w-full" onClick={luu}>Lưu</Nut>
      </div>
    </Modal>
  )
}
