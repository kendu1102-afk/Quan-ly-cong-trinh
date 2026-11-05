import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useDuLieu } from '../../lib/dulieu'
import { useAuth } from '../../lib/auth'
import type { CongTrinh } from '../../lib/ct'
import { docSo, fmtNgay, fmtTien, homNay, so, tong } from '../../lib/tinh'
import { Loi, Modal, Nut, The, Truong, o } from '../../components/ui'
import { thongBao } from '../../lib/thongbao'

type TT = { id: string; lan: number; ngay: string | null; gia_tri: number; ghi_chu: string; version: number }

/** Các lần thanh toán + số tiền chưa thanh toán (= giá trị hợp đồng − tổng đã thanh toán, tự tính) */
export default function ThanhToan({ cong }: { cong: CongTrinh }) {
  const { isAdmin } = useAuth()
  const q = useDuLieu<TT[]>(() => supabase.from('thanh_toan').select('*').eq('cong_trinh_id', cong.id).order('lan') as never, [cong.id], ['thanh_toan'], 'cache-tt-' + cong.id)
  const [sua, setSua] = useState<Partial<TT> | null>(null)
  const ds = q.data ?? []
  const da = tong(ds.map((x) => so(x.gia_tri)))
  const hd = so(cong.gia_tri_hop_dong)
  const chua = hd - da
  const xoa = async (x: TT) => {
    if (!confirm(`Xóa thanh toán lần ${x.lan} (${fmtTien(x.gia_tri)} đ)?`)) return
    const { error } = await supabase.from('thanh_toan').delete().eq('id', x.id)
    error ? thongBao(error.message, 'loi') : (thongBao('Đã xóa lần thanh toán'), q.tai())
  }
  const hang = 'flex items-center justify-between gap-3 border-b py-2'
  return (
    <The className="mt-3">
      <h3 className="mb-1 font-bold text-brand">💳 Thanh toán</h3>
      {q.loi && !q.cu && <Loi t="Chưa cài tính năng thanh toán (cần chạy tệp SQL 06 trên Supabase)." />}
      {!ds.length && !q.loi && <div className="py-2 text-slate-500">Chưa có lần thanh toán nào.</div>}
      {ds.map((x) => (
        <div key={x.id} className={hang}>
          <div><b>Thanh toán lần {x.lan}</b><div className="text-xs text-slate-500">{x.ngay ? fmtNgay(x.ngay) : 'chưa ghi ngày'}{x.ghi_chu ? ` · ${x.ghi_chu}` : ''}</div></div>
          <div className="flex items-center gap-1"><b className="num">{fmtTien(x.gia_tri)} đ</b>
            {isAdmin && <><button className="px-2 py-1 text-sm text-brand-2" onClick={() => setSua(x)}>Sửa</button><button className="px-2 py-1 text-sm text-bad" onClick={() => xoa(x)}>Xóa</button></>}</div>
        </div>
      ))}
      {isAdmin && <Nut mau="phu" className="mt-2 w-full" onClick={() => setSua({ lan: (ds.length ? Math.max(...ds.map((x) => x.lan)) : 0) + 1 })}>＋ Thêm lần thanh toán</Nut>}
      <div className={hang + ' mt-1'}><span className="text-slate-600">Tổng đã thanh toán</span><b className="num text-ok">{fmtTien(da)} đ{hd > 0 && <span className="ml-1 text-sm font-medium text-slate-500">({((da / hd) * 100).toFixed(1)}%)</span>}</b></div>
      <div className="flex items-center justify-between gap-3 py-2">
        <span className="font-semibold text-slate-700">Số tiền chưa thanh toán</span>
        <b className={`num text-lg ${chua < 0 ? 'text-bad' : 'text-brand'}`}>{fmtTien(chua)} đ</b>
      </div>
      {chua < 0 && <div className="rounded-xl bg-red-50 p-2 text-sm text-bad">Tổng đã thanh toán đang vượt giá trị hợp đồng.</div>}
      <div className="text-xs text-slate-500">Chưa thanh toán = Giá trị hợp đồng ({fmtTien(hd)} đ) − tổng các lần thanh toán.</div>
      {sua && <FormTT x={sua} cong={cong.id} dong={() => setSua(null)} xong={() => { setSua(null); q.tai() }} />}
    </The>
  )
}

function FormTT({ x, cong, dong, xong }: { x: Partial<TT>; cong: string; dong: () => void; xong: () => void }) {
  const [f, setF] = useState({ lan: String(x.lan ?? 1), ngay: x.ngay ?? (x.id ? '' : homNay()), gt: x.gia_tri ? String(x.gia_tri) : '', gc: x.ghi_chu ?? '' }); const [loi, setLoi] = useState('')
  const luu = async () => {
    const lan = Number(f.lan), gt = docSo(f.gt)
    if (!Number.isInteger(lan) || lan < 1) return setLoi('Lần thanh toán phải là số nguyên từ 1')
    if (!(gt > 0)) return setLoi('Giá trị thanh toán phải lớn hơn 0')
    const row = { lan, ngay: f.ngay || null, gia_tri: gt, ghi_chu: f.gc }
    const r = x.id ? await supabase.from('thanh_toan').update(row, { count: 'exact' }).eq('id', x.id).eq('version', x.version!) : await supabase.from('thanh_toan').insert({ ...row, cong_trinh_id: cong })
    if (r.error) return setLoi(r.error.message.includes('duplicate') ? `Đã có thanh toán lần ${lan}. Hãy chọn số lần khác.` : r.error.message)
    if (x.id && r.count === 0) return setLoi('Dữ liệu vừa được người khác sửa, hãy đóng và mở lại.')
    thongBao('Đã lưu lần thanh toán'); xong()
  }
  return (
    <Modal tieuDe={x.id ? 'Sửa lần thanh toán' : 'Thêm lần thanh toán'} dong={dong}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Truong nhan="Lần thanh toán"><input className={o} inputMode="numeric" value={f.lan} onChange={(e) => setF({ ...f, lan: e.target.value })} /></Truong>
          <Truong nhan="Ngày thanh toán"><input type="date" className={o} value={f.ngay} onChange={(e) => setF({ ...f, ngay: e.target.value })} /></Truong>
        </div>
        <Truong nhan="Giá trị thanh toán (đồng)"><input className={o} inputMode="decimal" value={f.gt} onChange={(e) => setF({ ...f, gt: e.target.value })} /></Truong>
        <Truong nhan="Ghi chú"><input className={o} value={f.gc} onChange={(e) => setF({ ...f, gc: e.target.value })} placeholder="vd: tạm ứng, thanh toán đợt 1…" /></Truong>
        <Loi t={loi} /><Nut className="w-full" onClick={luu}>Lưu</Nut>
      </div>
    </Modal>
  )
}
