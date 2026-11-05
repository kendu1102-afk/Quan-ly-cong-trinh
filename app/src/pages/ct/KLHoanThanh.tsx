import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { CongTrinh } from '../../lib/ct'
import { docSo, fmtGio, fmtSo, so } from '../../lib/tinh'
import { Dang, Nut, Rong, TieuDe, o } from '../../components/ui'
import TienDoThucHien from '../../components/TienDo'
import { thongBao } from '../../lib/thongbao'
import { tongHopHangMuc, tyLeHM, useHangMuc, type HangMuc } from './hangmuc'

const bo = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

export default function KLHoanThanh({ cong }: { cong: CongTrinh }) {
  const { nguoi, isAdmin } = useAuth()
  const q = useHangMuc(cong.id)
  const [tim, setTim] = useState(''); const [chuaXong, setChuaXong] = useState(false)
  const [nhap, setNhap] = useState<Record<string, string>>({}); const [ban, setBan] = useState<string | null>(null)
  if (q.dangTai) return <Dang />
  const all = q.data ?? []
  const tk = tongHopHangMuc(all, so(cong.gia_tri_hop_dong))
  const ds = all.filter((h) => bo(`${h.stt} ${h.ten}`).includes(bo(tim)) && (!chuaXong || so(h.khoi_luong_hoan_thanh) < so(h.khoi_luong_hd)))

  const ghi = async (h: HangMuc, kl: number) => {
    setBan(h.id)
    const { error } = await supabase.rpc('cap_nhat_khoi_luong_hoan_thanh', { p_id: h.id, p_kl: kl, p_version: h.version })
    setBan(null)
    if (error) { thongBao(error.message.includes('fetch') ? 'Không có Internet, chưa cập nhật được' : error.message, 'loi'); q.tai(); return }
    setNhap((n) => { const x = { ...n }; delete x[h.id]; return x })
    thongBao(`Đã cập nhật: ${h.ten} — ${fmtSo(kl)}/${fmtSo(h.khoi_luong_hd)} ${h.dvt}`); q.tai()
  }
  const ap = (h: HangMuc) => {
    const kl = docSo(nhap[h.id] ?? '')
    if (!(kl >= 0)) return thongBao('Nhập khối lượng đã làm (số, từ 0 trở lên)', 'loi')
    if (kl > so(h.khoi_luong_hd)) return thongBao(`Không được vượt khối lượng hợp đồng (${fmtSo(h.khoi_luong_hd)} ${h.dvt})`, 'loi')
    ghi(h, kl)
  }
  return (
    <div className="space-y-3">
      <TieuDe>Nhập khối lượng hoàn thành</TieuDe>
      <TienDoThucHien gtThucHien={tk.gtThucHien} mau={tk.mau} tyLe={tk.tyLe} phu={all.length ? `${tk.soHoanThanh}/${all.length} hạng mục đã hoàn thành 100%` : undefined} />
      {!all.length ? (
        <Rong t={isAdmin ? 'Công trình chưa có khối lượng hợp đồng. Hãy nhập ở thẻ “Khối lượng hợp đồng” (hoặc tải file Excel lên) rồi quay lại đây.' : 'Admin chưa nhập khối lượng hợp đồng cho công trình này nên chưa có hạng mục để cập nhật.'} />
      ) : <>
        {isAdmin && !all.length && <Link to={`/ct/${cong.id}/kl-hop-dong`} className="text-brand-2 underline">Đến Khối lượng hợp đồng</Link>}
        <input className={o} placeholder="🔍 Tìm hạng mục…" value={tim} onChange={(e) => setTim(e.target.value)} />
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-6 w-6" checked={chuaXong} onChange={(e) => setChuaXong(e.target.checked)} />Chỉ hiện hạng mục chưa hoàn thành 100%</label>
        {!ds.length && <Rong t="Không có hạng mục nào" />}
        {ds.map((h) => {
          const ty = tyLeHM(h); const xong = ty >= 100; const gt = nhap[h.id]
          const doi = gt !== undefined && docSo(gt) !== so(h.khoi_luong_hoan_thanh)
          return (
            <div key={h.id} className={`the !p-3 ${xong ? 'ring-2 ring-green-400' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold text-brand"><span className="text-slate-500">{h.stt}.</span> {h.ten}</div>
                {xong && <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-semibold text-green-800">✔ 100%</span>}
              </div>
              <div className="mt-1 text-sm text-slate-600">Đơn vị: <b>{h.dvt}</b> · Khối lượng hợp đồng: <b className="num">{fmtSo(h.khoi_luong_hd)}</b></div>
              <div className="mt-2 flex items-center gap-3">
                <div className="thanh-tien flex-1"><i style={{ width: `${Math.min(ty, 100)}%`, background: xong ? '#15803d' : 'linear-gradient(90deg,#1b4aa3,#5b8def)' }} /></div>
                <span className="num w-28 text-right text-sm">Đã làm <b>{fmtSo(h.khoi_luong_hoan_thanh)}</b> ({ty.toFixed(0)}%)</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input className={`${o} !w-36 flex-1`} inputMode="decimal" placeholder="Khối lượng đã làm" value={gt ?? ''} onChange={(e) => setNhap((n) => ({ ...n, [h.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') ap(h) }} />
                <Nut className="min-h-12 px-4" disabled={ban === h.id || !doi} onClick={() => ap(h)}>Áp dụng</Nut>
                <Nut mau="vang" className="min-h-12 px-4" disabled={ban === h.id || xong} onClick={() => ghi(h, so(h.khoi_luong_hd))}>{xong ? '✔ Đã 100%' : '✔ Hoàn thành 100%'}</Nut>
              </div>
              {h.updated_at && <div className="mt-1 text-xs text-slate-500">Cập nhật bởi {nguoi[h.updated_by ?? ''] ?? '…'} lúc {fmtGio(h.updated_at)}</div>}
            </div>
          )
        })}
      </>}
    </div>
  )
}
