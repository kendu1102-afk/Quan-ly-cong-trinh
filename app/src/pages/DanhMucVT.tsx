import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useDuLieu } from '../lib/dulieu'
import { docSo, fmtTien } from '../lib/tinh'
import { Dang, Loi, Modal, Nut, Rong, The, TieuDe, Truong, o } from '../components/ui'
import { thongBao } from '../lib/thongbao'
import { docDanhMucExcel, mauDanhMuc, xuatExcel } from '../lib/excel'

export type DanhMuc = { id: string; ten: string; dvt: string; don_gia: number; ghi_chu: string; version: number }
export const useDanhMuc = () => useDuLieu<DanhMuc[]>(() => supabase.from('danh_muc_vat_tu').select('*').order('ten') as never, [], ['danh_muc_vat_tu'], 'cache-dmvt')
const bo = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')

export default function DanhMucVT() {
  const q = useDanhMuc()
  const [tim, setTim] = useState(''); const [sua, setSua] = useState<Partial<DanhMuc> | null>(null)
  const [xem, setXem] = useState<{ ten: string; dvt: string; don_gia: number; dong: number; loi?: string }[] | null>(null)
  const file = useRef<HTMLInputElement>(null)
  if (q.dangTai) return <Dang />
  const all = q.data ?? []
  const ds = all.filter((x) => bo(`${x.ten} ${x.dvt}`).includes(bo(tim)))

  const nhap = async (f: File) => {
    try {
      const r = await docDanhMucExcel(f)
      setXem(r.map((x) => ({ ...x, loi: !x.dvt ? 'Thiếu đơn vị' : !(x.don_gia >= 0) ? 'Đơn giá sai' : undefined })))
    } catch { thongBao('Không đọc được tệp Excel (.xlsx)', 'loi') }
  }
  const xacNhan = async () => {
    const m = new Map<string, { ten: string; dvt: string; don_gia: number }>()
    xem!.filter((x) => !x.loi).forEach((x) => m.set(x.ten, { ten: x.ten, dvt: x.dvt, don_gia: x.don_gia })) // trùng tên: dòng sau ghi đè
    const { error } = await supabase.from('danh_muc_vat_tu').upsert([...m.values()], { onConflict: 'ten' })
    if (error) return thongBao(error.message, 'loi')
    thongBao(`Đã nhập ${m.size} vật tư vào danh mục`); setXem(null); q.tai()
  }
  return (
    <div className="space-y-3">
      <TieuDe phai={<Nut mau="phu" className="min-h-10 px-3 text-sm" onClick={() => xuatExcel('danh-muc-vat-tu', 'Danh mục vật tư mẫu dùng chung', [{
        ten: 'Danh mục', cot: [{ tieuDe: 'Tên vật tư', khoa: 'a', rong: 32 }, { tieuDe: 'ĐVT', khoa: 'b' }, { tieuDe: 'Đơn giá tham khảo', khoa: 'c', dinhDang: 'tien' }, { tieuDe: 'Ghi chú', khoa: 'd', rong: 24 }],
        dong: all.map((x) => ({ a: x.ten, b: x.dvt, c: Number(x.don_gia), d: x.ghi_chu })),
      }])}>⬇ Excel</Nut>}>Nhập vật tư mẫu</TieuDe>
      <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
        Đây là danh mục <b>dùng chung cho tất cả công trình</b>. Khi lập “Vật tư theo dự toán” của một công trình, bạn chỉ cần gõ tìm và chọn từ danh mục này, không phải gõ lại tên, đơn vị, đơn giá.
      </div>
      <div className="flex flex-wrap gap-2">
        <Nut onClick={() => setSua({})}>＋ Thêm vật tư</Nut>
        <Nut mau="phu" onClick={() => file.current?.click()}>📥 Nhập từ Excel</Nut>
        <Nut mau="xam" onClick={mauDanhMuc}>Tải file mẫu</Nut>
        <input ref={file} type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) nhap(f) }} />
      </div>
      <input className={o} placeholder="🔍 Tìm vật tư…" value={tim} onChange={(e) => setTim(e.target.value)} />
      <div className="text-sm text-slate-600">{ds.length}/{all.length} vật tư</div>
      {!ds.length && <Rong t={all.length ? 'Không tìm thấy' : 'Chưa có vật tư nào. Bấm “＋ Thêm vật tư” hoặc “Nhập từ Excel”.'} />}
      {ds.map((x) => (
        <The key={x.id}><div className="flex items-start justify-between gap-2">
          <div><b className="text-brand">{x.ten}</b><div className="text-sm text-slate-600">Đơn vị: {x.dvt} · Đơn giá tham khảo: <span className="num font-semibold">{fmtTien(x.don_gia)}</span> đ</div>{x.ghi_chu && <div className="text-sm text-slate-500">📝 {x.ghi_chu}</div>}</div>
          <div className="flex gap-1"><Nut mau="phu" className="min-h-10 px-3 text-sm" onClick={() => setSua(x)}>Sửa</Nut>
            <Nut mau="do" className="min-h-10 px-3 text-sm" onClick={async () => {
              if (!confirm(`Xóa “${x.ten}” khỏi danh mục?\n(Các công trình đã dùng vật tư này không bị ảnh hưởng)`)) return
              const { error } = await supabase.from('danh_muc_vat_tu').delete().eq('id', x.id)
              error ? thongBao(error.message, 'loi') : (thongBao('Đã xóa'), q.tai())
            }}>Xóa</Nut></div>
        </div></The>
      ))}
      {sua && <FormDM m={sua} dong={() => setSua(null)} xong={() => { setSua(null); q.tai() }} />}
      {xem && (
        <Modal tieuDe={`Xem trước: ${xem.length} dòng`} dong={() => setXem(null)}>
          <p className="mb-2 text-sm text-slate-600">Vật tư trùng tên sẽ được cập nhật. Dòng lỗi sẽ bị bỏ qua.</p>
          <div className="max-h-80 space-y-1 overflow-y-auto">{xem.map((x) => <div key={x.dong} className={`rounded-lg p-2 text-sm ${x.loi ? 'bg-red-50 text-bad' : 'hang-nen'}`}>#{x.dong} {x.ten} · {x.dvt} · {x.don_gia} {x.loi && `— ${x.loi}`}</div>)}</div>
          <Nut className="mt-3 w-full" disabled={!xem.some((x) => !x.loi)} onClick={xacNhan}>Nhập {xem.filter((x) => !x.loi).length} dòng hợp lệ</Nut>
        </Modal>
      )}
    </div>
  )
}

function FormDM({ m, dong, xong }: { m: Partial<DanhMuc>; dong: () => void; xong: () => void }) {
  const [f, setF] = useState({ ten: m.ten ?? '', dvt: m.dvt ?? '', dg: m.don_gia ? String(m.don_gia) : '', gc: m.ghi_chu ?? '' }); const [loi, setLoi] = useState('')
  const luu = async () => {
    const dg = f.dg === '' ? 0 : docSo(f.dg)
    if (!f.ten.trim() || !f.dvt.trim()) return setLoi('Nhập tên và đơn vị tính')
    if (!(dg >= 0)) return setLoi('Đơn giá phải là số ≥ 0')
    const row = { ten: f.ten.trim(), dvt: f.dvt.trim(), don_gia: dg, ghi_chu: f.gc }
    const r = m.id ? await supabase.from('danh_muc_vat_tu').update(row, { count: 'exact' }).eq('id', m.id).eq('version', m.version!) : await supabase.from('danh_muc_vat_tu').insert(row)
    if (r.error) return setLoi(r.error.message.includes('duplicate') ? 'Đã có vật tư trùng tên trong danh mục' : r.error.message)
    if (m.id && r.count === 0) return setLoi('Dữ liệu vừa được người khác sửa, hãy đóng và mở lại.')
    thongBao('Đã lưu vào danh mục'); xong()
  }
  return (
    <Modal tieuDe={m.id ? 'Sửa vật tư trong danh mục' : 'Thêm vật tư vào danh mục'} dong={dong}>
      <div className="space-y-3">
        <Truong nhan="Tên vật tư"><input className={o} value={f.ten} onChange={(e) => setF({ ...f, ten: e.target.value })} /></Truong>
        <Truong nhan="Đơn vị tính"><input className={o} value={f.dvt} onChange={(e) => setF({ ...f, dvt: e.target.value })} placeholder="m3, tấn, kg, cái…" /></Truong>
        <Truong nhan="Đơn giá tham khảo (đồng, có thể để trống)"><input className={o} inputMode="decimal" value={f.dg} onChange={(e) => setF({ ...f, dg: e.target.value })} /></Truong>
        <Truong nhan="Ghi chú"><input className={o} value={f.gc} onChange={(e) => setF({ ...f, gc: e.target.value })} /></Truong>
        <Loi t={loi} /><Nut className="w-full" onClick={luu}>Lưu</Nut>
      </div>
    </Modal>
  )
}
