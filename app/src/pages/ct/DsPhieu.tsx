import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useDuLieu } from '../../lib/dulieu'
import { useAuth } from '../../lib/auth'
import { dauThang, dauTuan, docSo, fmtGio, fmtNgay, fmtSo, fmtTien, homNay, so, thanhTien, tong } from '../../lib/tinh'
import { ChonTim, Dang, Huy, Loi, Modal, Nut, Rong, Truong, o, Lua } from '../../components/ui'
import { ChonTep, NutTep, type TepRow, moTep } from '../../components/Tep'
import { guiTep } from '../../lib/hangdoi'
import { thongBao } from '../../lib/thongbao'
import { xuatExcel } from '../../lib/excel'

export type VatTuMau = { id: string; ten: string; dvt: string; khoi_luong_dt: number; don_gia_dt: number }
export type PhieuVT = {
  id: string; vat_tu_id: string; ngay: string; khoi_luong: number; don_gia: number; thanh_tien: number; co_hoa_don: boolean; ghi_chu: string
  created_by: string; created_at: string; updated_by: string | null; updated_at: string | null; version: number; vat_tu_mau: { ten: string; dvt: string }
}
export type Loc = { tu?: string; den?: string; vatTuId?: string; coHD?: boolean | null }

export function useTep(ct: string, loai: 'vat_tu' | 'chi_phi') {
  const q = useDuLieu<TepRow[]>(() => supabase.from('tep_dinh_kem').select('id,ban_ghi_id,duong_dan,ten_tep').eq('cong_trinh_id', ct).eq('loai', loai) as never, [ct, loai], ['tep_dinh_kem'])
  return useMemo(() => { const m = new Map<string, TepRow[]>(); (q.data ?? []).forEach((t) => m.set(t.ban_ghi_id, [...(m.get(t.ban_ghi_id) ?? []), t])); return m }, [q.data])
}

/** Danh sách phiếu nhập vật tư (dùng ở trang Nhập vật tư và khi bấm xem chi tiết từ tổng hợp/biểu đồ) */
export default function DsPhieuVT({ ct, vatTu, loc, goc = false, tieuDeXuat = 'phieu-vat-tu' }: { ct: string; vatTu: VatTuMau[]; loc: Loc; goc?: boolean; tieuDeXuat?: string }) {
  const { ho, isAdmin, nguoi } = useAuth()
  const [sua, setSua] = useState<PhieuVT | null>(null)
  const tep = useTep(ct, 'vat_tu')
  const q = useDuLieu<PhieuVT[]>(() => {
    let b = supabase.from('phieu_nhap_vt').select('*, vat_tu_mau(ten,dvt)').eq('cong_trinh_id', ct).eq('da_xoa', false)
    if (loc.tu) b = b.gte('ngay', loc.tu)
    if (loc.den) b = b.lte('ngay', loc.den)
    if (loc.vatTuId) b = b.eq('vat_tu_id', loc.vatTuId)
    if (loc.coHD !== null && loc.coHD !== undefined) b = b.eq('co_hoa_don', loc.coHD)
    return b.order('ngay', { ascending: false }).order('created_at', { ascending: false }).limit(2000) as never
  }, [ct, loc.tu, loc.den, loc.vatTuId, loc.coHD], ['phieu_nhap_vt'], `cache-phieu-${ct}-${JSON.stringify(loc)}`)
  const ds = q.data ?? []
  if (q.dangTai) return <Dang />
  const xoa = async (p: PhieuVT) => {
    if (!confirm(`Xóa phiếu ${p.vat_tu_mau.ten} ngày ${fmtNgay(p.ngay)}?\n(Admin có thể khôi phục từ nhật ký)`)) return
    const { error, count } = await supabase.from('phieu_nhap_vt').update({ da_xoa: true }, { count: 'exact' }).eq('id', p.id).eq('version', p.version)
    if (error) return thongBao(error.message, 'loi')
    if (!count) return thongBao('Phiếu đã được người khác thay đổi, hãy tải lại', 'loi')
    thongBao('Đã xóa phiếu'); q.tai()
  }
  return (
    <div className="space-y-2">
      <Loi t={q.loi && !q.cu ? q.loi : ''} />
      {q.cu && <div className="rounded-xl bg-amber-50 p-2 text-sm text-warn">Đang xem dữ liệu đã lưu trên máy (mất mạng)</div>}
      <div className="flex items-center justify-between">
        <div className="text-slate-600">{ds.length} phiếu · Tổng <b className="num text-brand">{fmtTien(tong(ds.map((p) => so(p.thanh_tien))))}</b> đ</div>
        <Nut mau="phu" className="min-h-10 px-3 text-sm" onClick={() => xuatExcel(tieuDeXuat, 'Phiếu nhập vật tư', [{
          ten: 'Phiếu nhập', cot: [{ tieuDe: 'Ngày', khoa: 'ngay' }, { tieuDe: 'Tên vật tư', khoa: 'ten', rong: 28 }, { tieuDe: 'ĐVT', khoa: 'dvt', rong: 8 }, { tieuDe: 'Khối lượng', khoa: 'kl', dinhDang: 'so' },
            { tieuDe: 'Đơn giá', khoa: 'dg', dinhDang: 'tien' }, { tieuDe: 'Thành tiền', khoa: 'tt', dinhDang: 'tien' }, { tieuDe: 'Hóa đơn', khoa: 'hd' }, { tieuDe: 'Ghi chú', khoa: 'gc', rong: 24 }, { tieuDe: 'Người nhập', khoa: 'nn', rong: 18 }, { tieuDe: 'Giờ nhập', khoa: 'gio', rong: 18 }],
          dong: ds.map((p) => ({ ngay: fmtNgay(p.ngay), ten: p.vat_tu_mau.ten, dvt: p.vat_tu_mau.dvt, kl: so(p.khoi_luong), dg: so(p.don_gia), tt: so(p.thanh_tien), hd: p.co_hoa_don ? 'Có hóa đơn' : 'Không hóa đơn', gc: p.ghi_chu, nn: nguoi[p.created_by] ?? '', gio: fmtGio(p.created_at) })),
          tongDong: { ten: 'TỔNG', tt: tong(ds.map((p) => so(p.thanh_tien))) },
        }])}>⬇ Excel</Nut>
      </div>
      {!ds.length && <Rong t="Không có phiếu nào" />}
      {ds.map((p) => {
        const quyen = isAdmin || p.created_by === ho?.id
        return (
          <div key={p.id} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-2">
              <div><b className="text-brand">{p.vat_tu_mau.ten}</b> <span className="text-slate-500">· {fmtNgay(p.ngay)}</span></div>
              <Huy loai={p.co_hoa_don ? 'ok' : 'dat'}>{p.co_hoa_don ? 'Có hóa đơn' : 'Không hóa đơn'}</Huy>
            </div>
            <div className="num">{fmtSo(p.khoi_luong)} {p.vat_tu_mau.dvt} × {fmtTien(p.don_gia)} = <b>{fmtTien(p.thanh_tien)}</b> đ</div>
            {p.ghi_chu && <div className="text-sm text-slate-600">📝 {p.ghi_chu}</div>}
            <div className="mt-1 text-xs text-slate-500">Nhập bởi {nguoi[p.created_by] ?? '…'} lúc {fmtGio(p.created_at)}{p.updated_at ? ` · sửa bởi ${nguoi[p.updated_by ?? ''] ?? '…'} lúc ${fmtGio(p.updated_at)}` : ''}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <NutTep teps={tep.get(p.id)} />
              {!goc && quyen && <><Nut mau="phu" className="ml-auto min-h-10 px-3 text-sm" onClick={() => setSua(p)}>Sửa</Nut><Nut mau="do" className="min-h-10 px-3 text-sm" onClick={() => xoa(p)}>Xóa</Nut></>}
            </div>
          </div>
        )
      })}
      {sua && <SuaPhieuVT p={sua} ct={ct} vatTu={vatTu} tep={tep.get(sua.id) ?? []} dong={() => setSua(null)} xong={() => { setSua(null); q.tai() }} />}
    </div>
  )
}

function SuaPhieuVT({ p, ct, vatTu, tep, dong, xong }: { p: PhieuVT; ct: string; vatTu: VatTuMau[]; tep: TepRow[]; dong: () => void; xong: () => void }) {
  const { isAdmin, ho } = useAuth()
  const [f, setF] = useState({ ngay: p.ngay, vat_tu_id: p.vat_tu_id, kl: String(p.khoi_luong), dg: String(p.don_gia), hd: p.co_hoa_don as boolean | null, gc: p.ghi_chu })
  const [moi, setMoi] = useState<{ name: string; blob: Blob }[]>([])
  const [loi, setLoi] = useState(''); const [ban, setBan] = useState(false)
  const kl = docSo(f.kl), dg = docSo(f.dg)
  const luu = async () => {
    if (!f.vat_tu_id || !(kl > 0) || !(dg >= 0) || f.hd === null) return setLoi('Kiểm tra lại: vật tư, khối lượng > 0, đơn giá, tình trạng hóa đơn')
    setBan(true); setLoi('')
    const { error, count } = await supabase.from('phieu_nhap_vt').update({ ngay: f.ngay, vat_tu_id: f.vat_tu_id, khoi_luong: kl, don_gia: dg, co_hoa_don: f.hd, ghi_chu: f.gc }, { count: 'exact' }).eq('id', p.id).eq('version', p.version)
    if (error) { setBan(false); return setLoi(error.message) }
    if (!count) { setBan(false); return setLoi('Phiếu vừa được người khác sửa. Đóng lại để xem bản mới nhất rồi sửa tiếp.') }
    try { if (moi.length) await guiTep(ho!.id, 'vat_tu', ct, p.id, moi, tep.length + 100) } catch (e) { setBan(false); return setLoi('Đã lưu phiếu nhưng tải tệp lỗi: ' + (e as Error).message) }
    setBan(false); thongBao('Đã sửa phiếu'); xong()
  }
  return (
    <Modal tieuDe="Sửa phiếu nhập vật tư" dong={dong}>
      <div className="space-y-3">
        <Truong nhan="Ngày"><input type="date" className={o} value={f.ngay} onChange={(e) => setF({ ...f, ngay: e.target.value })} /></Truong>
        <Truong nhan="Vật tư"><ChonTim ds={vatTu} gt={f.vat_tu_id} doi={(id) => setF({ ...f, vat_tu_id: id })} nhan={(x) => `${x.ten} (${x.dvt})`} /></Truong>
        <div className="grid grid-cols-2 gap-3">
          <Truong nhan="Khối lượng"><input className={o} inputMode="decimal" value={f.kl} onChange={(e) => setF({ ...f, kl: e.target.value })} /></Truong>
          <Truong nhan="Đơn giá"><input className={o} inputMode="decimal" value={f.dg} onChange={(e) => setF({ ...f, dg: e.target.value })} /></Truong>
        </div>
        <div className="text-lg">Thành tiền: <b className="num text-brand">{fmtTien(thanhTien(kl || 0, dg || 0))}</b> đ</div>
        <Truong nhan="Hóa đơn"><Lua gt={f.hd} doi={(v) => setF({ ...f, hd: v })} mục={[{ v: true, t: 'Có hóa đơn', c: 'bg-ok text-white border-ok' }, { v: false, t: 'Không có hóa đơn', c: 'bg-warn text-white border-warn' }]} /></Truong>
        <Truong nhan="Ghi chú"><input className={o} value={f.gc} onChange={(e) => setF({ ...f, gc: e.target.value })} /></Truong>
        {tep.map((t) => <div key={t.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"><button className="text-blue-800" onClick={() => moTep(t.duong_dan)}>📎 {t.ten_tep || 'Tệp'}</button>
          {isAdmin && <button className="text-bad" onClick={async () => { if (!confirm('Xóa tệp này?')) return; await supabase.storage.from('chung-tu').remove([t.duong_dan]); await supabase.from('tep_dinh_kem').delete().eq('id', t.id); xong() }}>Xóa</button>}</div>)}
        <ChonTep teps={moi} doi={setMoi} />
        <Loi t={loi} />
        <Nut className="w-full" disabled={ban} onClick={luu}>{ban ? 'Đang lưu…' : 'Lưu thay đổi'}</Nut>
      </div>
    </Modal>
  )
}

export function BoLoc({ loc, doi, vatTu }: { loc: Loc; doi: (l: Loc) => void; vatTu: VatTuMau[] }) {
  const t = homNay()
  return (
    <div className="space-y-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
      <div className="flex flex-wrap gap-2">
        <Nut mau="xam" className="min-h-10 px-3 text-sm" onClick={() => doi({ ...loc, tu: t, den: t })}>Hôm nay</Nut>
        <Nut mau="xam" className="min-h-10 px-3 text-sm" onClick={() => doi({ ...loc, tu: dauTuan(), den: t })}>Tuần này</Nut>
        <Nut mau="xam" className="min-h-10 px-3 text-sm" onClick={() => doi({ ...loc, tu: dauThang(), den: t })}>Tháng này</Nut>
        <Nut mau="xam" className="min-h-10 px-3 text-sm" onClick={() => doi({})}>Tất cả</Nut>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Truong nhan="Từ ngày"><input type="date" className={o} value={loc.tu ?? ''} onChange={(e) => doi({ ...loc, tu: e.target.value || undefined })} /></Truong>
        <Truong nhan="Đến ngày"><input type="date" className={o} value={loc.den ?? ''} onChange={(e) => doi({ ...loc, den: e.target.value || undefined })} /></Truong>
      </div>
      <select className={o} value={loc.vatTuId ?? ''} onChange={(e) => doi({ ...loc, vatTuId: e.target.value || undefined })}>
        <option value="">Tất cả vật tư</option>{vatTu.map((v) => <option key={v.id} value={v.id}>{v.ten}</option>)}
      </select>
      <select className={o} value={loc.coHD === null || loc.coHD === undefined ? '' : String(loc.coHD)} onChange={(e) => doi({ ...loc, coHD: e.target.value === '' ? null : e.target.value === 'true' })}>
        <option value="">Có và không hóa đơn</option><option value="true">Chỉ có hóa đơn</option><option value="false">Chỉ không hóa đơn</option>
      </select>
    </div>
  )
}
