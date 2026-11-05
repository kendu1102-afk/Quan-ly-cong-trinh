import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useDuLieu } from '../../lib/dulieu'
import { docSo, fmtSo, fmtTien, so, tong } from '../../lib/tinh'
import { Dang, Loi, Modal, Nut, Rong, The, TieuDe, Truong, o } from '../../components/ui'
import { thongBao } from '../../lib/thongbao'
import { docVatTuExcel, mauVatTu, xuatExcel } from '../../lib/excel'
import { useVatTu } from './NhapVT'

type Mau = { id?: string; ten: string; dvt: string; khoi_luong_dt: number; don_gia_dt: number; version?: number }

export default function VatTuMau({ ct }: { ct: string }) {
  const { isAdmin } = useAuth()
  const q = useVatTu(ct)
  const full = useVatTuFull(ct)
  const [q2, setQ] = useState(''); const [sua, setSua] = useState<Mau | null>(null); const [xem, setXem] = useState<{ ten: string; dvt: string; khoi_luong_dt: number; don_gia_dt: number; dong: number; loi?: string }[] | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const bo = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
  if (q.dangTai || full.dangTai) return <Dang />
  const ds = (full.data ?? []).filter((x) => bo(x.ten).includes(bo(q2)))

  const nhap = async (f: File) => {
    try {
      const r = await docVatTuExcel(f)
      setXem(r.map((x) => ({ ...x, loi: !x.dvt ? 'Thiếu đơn vị' : !(x.khoi_luong_dt >= 0) ? 'Khối lượng sai' : !(x.don_gia_dt >= 0) ? 'Đơn giá sai' : undefined })))
    } catch { thongBao('Không đọc được tệp Excel (.xlsx)', 'loi') }
  }
  const xacNhan = async () => {
    const hop = xem!.filter((x) => !x.loi)
    const trung = new Map<string, typeof hop[number]>(); hop.forEach((x) => trung.set(x.ten, x)) // dòng sau ghi đè dòng trước cùng tên
    const rows = [...trung.values()].map((x) => ({ cong_trinh_id: ct, ten: x.ten, dvt: x.dvt, khoi_luong_dt: x.khoi_luong_dt, don_gia_dt: x.don_gia_dt }))
    const { error } = await supabase.from('vat_tu_mau').upsert(rows, { onConflict: 'cong_trinh_id,ten' })
    if (error) return thongBao(error.message, 'loi')
    thongBao(`Đã nhập ${rows.length} vật tư`); setXem(null); full.tai()
  }
  return (
    <div className="space-y-3">
      <TieuDe phai={<Nut mau="phu" className="min-h-10 px-3 text-sm" onClick={() => xuatExcel('vat-tu-mau', 'Vật tư theo dự toán', [{
        ten: 'Dự toán', cot: [{ tieuDe: 'Tên vật tư', khoa: 'ten', rong: 30 }, { tieuDe: 'ĐVT', khoa: 'dvt' }, { tieuDe: 'KL dự toán', khoa: 'kl', dinhDang: 'so' }, { tieuDe: 'Đơn giá', khoa: 'dg', dinhDang: 'tien' }, { tieuDe: 'Thành tiền', khoa: 'tt', dinhDang: 'tien' }],
        dong: (full.data ?? []).map((x) => ({ ten: x.ten, dvt: x.dvt, kl: so(x.khoi_luong_dt), dg: so(x.don_gia_dt), tt: so(x.khoi_luong_dt) * so(x.don_gia_dt) })),
      }])}>⬇ Excel</Nut>}>Vật tư theo dự toán</TieuDe>
      {isAdmin ? (
        <div className="flex flex-wrap gap-2">
          <Nut onClick={() => setSua({ ten: '', dvt: '', khoi_luong_dt: 0, don_gia_dt: 0 })}>＋ Thêm vật tư</Nut>
          <Nut mau="phu" onClick={() => file.current?.click()}>📥 Nhập từ Excel</Nut>
          <Nut mau="xam" onClick={mauVatTu}>Tải file mẫu</Nut>
          <input ref={file} type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) nhap(f) }} />
        </div>
      ) : <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Danh sách này do Admin quản lý. Kế toán chỉ xem.</div>}
      <input className={o} placeholder="🔍 Tìm vật tư…" value={q2} onChange={(e) => setQ(e.target.value)} />
      {!ds.length && <Rong t="Chưa có vật tư mẫu" />}
      {ds.map((x) => (
        <The key={x.id}><div className="flex items-start justify-between gap-2">
          <div><b className="text-brand">{x.ten}</b><div className="num text-sm text-slate-600">{fmtSo(x.khoi_luong_dt)} {x.dvt} × {fmtTien(x.don_gia_dt)}</div><div className="num font-semibold">Thành tiền DT: {fmtTien(so(x.khoi_luong_dt) * so(x.don_gia_dt))} đ</div></div>
          {isAdmin && <div className="flex gap-1"><Nut mau="phu" className="min-h-10 px-3 text-sm" onClick={() => setSua(x)}>Sửa</Nut>
            <Nut mau="do" className="min-h-10 px-3 text-sm" onClick={async () => {
              if (!confirm(`Xóa vật tư “${x.ten}”?`)) return
              const { error } = await supabase.from('vat_tu_mau').delete().eq('id', x.id!)
              error ? thongBao(error.message.includes('foreign key') ? 'Vật tư đã có phiếu nhập, không thể xóa. Hãy xóa các phiếu trước.' : error.message, 'loi') : (thongBao('Đã xóa'), full.tai())
            }}>Xóa</Nut></div>}
        </div></The>
      ))}
      {!!ds.length && <div className="text-right font-semibold num">Tổng dự toán vật tư: {fmtTien(tong((full.data ?? []).map((x) => so(x.khoi_luong_dt) * so(x.don_gia_dt))))} đ</div>}
      {sua && <FormMau m={sua} ct={ct} dong={() => setSua(null)} xong={() => { setSua(null); full.tai() }} />}
      {xem && (
        <Modal tieuDe={`Xem trước: ${xem.length} dòng`} dong={() => setXem(null)}>
          <p className="mb-2 text-sm text-slate-600">Vật tư trùng tên sẽ được cập nhật. Dòng lỗi sẽ bị bỏ qua.</p>
          <div className="max-h-80 space-y-1 overflow-y-auto">{xem.map((x) => <div key={x.dong} className={`rounded-lg p-2 text-sm ${x.loi ? 'bg-red-50 text-bad' : 'bg-slate-50'}`}>#{x.dong} {x.ten} · {x.dvt} · {x.khoi_luong_dt} · {x.don_gia_dt} {x.loi && `— ${x.loi}`}</div>)}</div>
          <Nut className="mt-3 w-full" disabled={!xem.some((x) => !x.loi)} onClick={xacNhan}>Nhập {xem.filter((x) => !x.loi).length} dòng hợp lệ</Nut>
        </Modal>
      )}
    </div>
  )
}

function useVatTuFull(ct: string) {
  return useDuLieu<Mau[]>(() => supabase.from('vat_tu_mau').select('id,ten,dvt,khoi_luong_dt,don_gia_dt,version').eq('cong_trinh_id', ct).order('ten') as never, [ct], ['vat_tu_mau'], 'cache-vtm-full-' + ct)
}

function FormMau({ m, ct, dong, xong }: { m: Mau; ct: string; dong: () => void; xong: () => void }) {
  const [f, setF] = useState({ ten: m.ten, dvt: m.dvt, kl: String(m.khoi_luong_dt || ''), dg: String(m.don_gia_dt || '') })
  const [loi, setLoi] = useState('')
  const luu = async () => {
    const kl = docSo(f.kl || '0'), dg = docSo(f.dg || '0')
    if (!f.ten.trim() || !f.dvt.trim()) return setLoi('Nhập tên và đơn vị tính')
    if (!(kl >= 0) || !(dg >= 0)) return setLoi('Khối lượng và đơn giá phải là số ≥ 0')
    const row = { ten: f.ten.trim(), dvt: f.dvt.trim(), khoi_luong_dt: kl, don_gia_dt: dg }
    const r = m.id ? await supabase.from('vat_tu_mau').update(row, { count: 'exact' }).eq('id', m.id).eq('version', m.version!) : await supabase.from('vat_tu_mau').insert({ ...row, cong_trinh_id: ct })
    if (r.error) return setLoi(r.error.message.includes('duplicate') ? 'Đã có vật tư trùng tên' : r.error.message)
    if (m.id && r.count === 0) return setLoi('Dữ liệu vừa được người khác sửa, đóng lại và mở lại.')
    thongBao('Đã lưu vật tư'); xong()
  }
  return (
    <Modal tieuDe={m.id ? 'Sửa vật tư mẫu' : 'Thêm vật tư mẫu'} dong={dong}>
      <div className="space-y-3">
        <Truong nhan="Tên vật tư"><input className={o} value={f.ten} onChange={(e) => setF({ ...f, ten: e.target.value })} /></Truong>
        <Truong nhan="Đơn vị tính"><input className={o} value={f.dvt} onChange={(e) => setF({ ...f, dvt: e.target.value })} placeholder="m3, tấn, kg, cái…" /></Truong>
        <Truong nhan="Khối lượng theo dự toán"><input className={o} inputMode="decimal" value={f.kl} onChange={(e) => setF({ ...f, kl: e.target.value })} /></Truong>
        <Truong nhan="Đơn giá dự toán"><input className={o} inputMode="decimal" value={f.dg} onChange={(e) => setF({ ...f, dg: e.target.value })} /></Truong>
        <div>Thành tiền dự toán: <b className="num text-brand">{fmtTien((docSo(f.kl || '0') || 0) * (docSo(f.dg || '0') || 0))}</b> đ</div>
        <Loi t={loi} /><Nut className="w-full" onClick={luu}>Lưu</Nut>
      </div>
    </Modal>
  )
}
