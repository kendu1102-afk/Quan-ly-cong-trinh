import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useDuLieu } from '../../lib/dulieu'
import { useAuth } from '../../lib/auth'
import { docSo, fmtTien, homNay, thanhTien, tong, uuid } from '../../lib/tinh'
import { ChonTim, Dang, Lua, Loi, Nut, Rong, The, TieuDe, Truong, o } from '../../components/ui'
import { ChonTep } from '../../components/Tep'
import { dongBo, themHangDoi } from '../../lib/hangdoi'
import { thongBao } from '../../lib/thongbao'
import DsPhieuVT, { BoLoc, type Loc, type VatTuMau } from './DsPhieu'

export const useVatTu = (ct: string) => useDuLieu<VatTuMau[]>(
  () => supabase.from('vat_tu_mau').select('id,ten,dvt,khoi_luong_dt,don_gia_dt').eq('cong_trinh_id', ct).order('ten') as never, [ct], ['vat_tu_mau'], 'cache-vtm-' + ct)

type Dong = { k: string; vat_tu_id: string; kl: string; dg: string; hd: boolean | null; gc: string; teps: { name: string; blob: Blob }[] }
const dongMoi = (): Dong => ({ k: uuid(), vat_tu_id: '', kl: '', dg: '', hd: null, gc: '', teps: [] })

export default function NhapVT({ ct }: { ct: string }) {
  const { ho } = useAuth()
  const vt = useVatTu(ct)
  const [ngay, setNgay] = useState(homNay())
  const [dongs, setDongs] = useState<Dong[]>([dongMoi()])
  const [loi, setLoi] = useState(''); const [ban, setBan] = useState(false)
  const [loc, setLoc] = useState<Loc>({ tu: homNay(), den: homNay() })
  const [xem, setXem] = useState(false)
  if (vt.dangTai) return <Dang />
  const ds = vt.data ?? []
  const sua = (k: string, p: Partial<Dong>) => setDongs((a) => a.map((d) => (d.k === k ? { ...d, ...p } : d)))
  const tinh = (d: Dong) => thanhTien(docSo(d.kl) || 0, docSo(d.dg) || 0)

  const luu = async () => {
    setLoi('')
    for (const [i, d] of dongs.entries()) {
      const kl = docSo(d.kl), dg = docSo(d.dg), n = `Dòng ${i + 1}: `
      if (!d.vat_tu_id) return setLoi(n + 'chưa chọn vật tư')
      if (!(kl > 0)) return setLoi(n + 'khối lượng phải lớn hơn 0')
      if (!(dg >= 0)) return setLoi(n + 'chưa nhập đơn giá')
      if (d.hd === null) return setLoi(n + 'BẮT BUỘC chọn “Có hóa đơn” hoặc “Không có hóa đơn”')
    }
    if (!ngay) return setLoi('Chưa chọn ngày')
    setBan(true)
    for (const d of dongs) {
      const id = uuid()
      await themHangDoi({
        id, uid: ho!.id, loai: 'vat_tu', congTrinhId: ct, teps: d.teps,
        hang: { id, client_id: id, cong_trinh_id: ct, vat_tu_id: d.vat_tu_id, ngay, khoi_luong: docSo(d.kl), don_gia: docSo(d.dg), co_hoa_don: d.hd, ghi_chu: d.gc, created_by: ho!.id },
      })
    }
    const r = await dongBo(ho!.id)
    setBan(false)
    thongBao(r.con ? `Đã lưu ${dongs.length} dòng trên máy — sẽ tự gửi khi có Internet` : `Đã lưu ${dongs.length} phiếu vật tư`, r.con ? 'canhbao' : 'ok')
    setDongs([dongMoi()])
  }

  return (
    <div className="space-y-4">
      <TieuDe>Nhập vật tư hàng ngày</TieuDe>
      {!ds.length ? <Rong t="Công trình chưa có danh sách vật tư mẫu. Admin cần nhập ở thẻ “Vật tư mẫu” trước." /> : (
        <The className="space-y-4">
          <Truong nhan="Ngày nhập"><input type="date" className={o} value={ngay} onChange={(e) => setNgay(e.target.value)} /></Truong>
          {dongs.map((d, i) => {
            const m = ds.find((x) => x.id === d.vat_tu_id)
            return (
              <div key={d.k} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between"><b className="text-brand">Dòng {i + 1}</b>
                  {dongs.length > 1 && <button className="h-10 px-2 text-bad" onClick={() => setDongs((a) => a.filter((x) => x.k !== d.k))}>✕ Bỏ dòng</button>}</div>
                <Truong nhan="Tên vật tư (gõ để tìm)">
                  <ChonTim ds={ds} gt={d.vat_tu_id} nhan={(x) => x.ten} placeholder="Chọn vật tư…" hienThi={(x) => <span>{x.ten} <span className="text-slate-500">({x.dvt})</span></span>}
                    doi={(id) => { const v = ds.find((x) => x.id === id)!; sua(d.k, { vat_tu_id: id, dg: d.dg || String(v.don_gia_dt || '') }) }} />
                </Truong>
                <div className="grid grid-cols-3 gap-2">
                  <Truong nhan="Đơn vị"><div className={`${o} flex items-center bg-slate-100`}>{m?.dvt ?? '—'}</div></Truong>
                  <Truong nhan="Khối lượng"><input className={o} inputMode="decimal" value={d.kl} onChange={(e) => sua(d.k, { kl: e.target.value })} /></Truong>
                  <Truong nhan="Đơn giá"><input className={o} inputMode="decimal" value={d.dg} onChange={(e) => sua(d.k, { dg: e.target.value })} /></Truong>
                </div>
                <div className="text-lg">Thành tiền: <b className="num text-brand">{fmtTien(tinh(d))}</b> đ</div>
                <Truong nut nhan="Tình trạng hóa đơn *"><Lua gt={d.hd} doi={(v) => sua(d.k, { hd: v })} mục={[{ v: true, t: '✔ Có hóa đơn', c: 'bg-ok text-white border-ok' }, { v: false, t: '✘ Không có hóa đơn', c: 'bg-warn text-white border-warn' }]} /></Truong>
                <Truong nhan="Ghi chú"><input className={o} value={d.gc} onChange={(e) => sua(d.k, { gc: e.target.value })} /></Truong>
                <ChonTep teps={d.teps} doi={(t) => sua(d.k, { teps: t })} />
              </div>
            )
          })}
          <Nut mau="phu" className="w-full" onClick={() => setDongs((a) => [...a, dongMoi()])}>＋ Thêm vật tư khác</Nut>
          <div className="text-lg">Tổng phiếu: <b className="num text-brand">{fmtTien(tong(dongs.map(tinh)))}</b> đ</div>
          <Loi t={loi} />
          <Nut className="w-full text-lg" disabled={ban} onClick={luu}>{ban ? 'Đang lưu…' : '💾 LƯU PHIẾU NHẬP'}</Nut>
        </The>
      )}
      <TieuDe phai={<Nut mau="phu" className="min-h-10 px-3 text-sm" onClick={() => setXem(!xem)}>{xem ? 'Thu gọn lọc' : '🔍 Lọc'}</Nut>}>Lịch sử nhập vật tư</TieuDe>
      {xem && <BoLoc loc={loc} doi={setLoc} vatTu={ds} />}
      <DsPhieuVT ct={ct} vatTu={ds} loc={loc} />
    </div>
  )
}
