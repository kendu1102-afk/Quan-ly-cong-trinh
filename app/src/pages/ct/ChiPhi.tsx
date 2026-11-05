import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useDuLieu } from '../../lib/dulieu'
import { useAuth } from '../../lib/auth'
import { CHUNG_TU, dauThang, dauTuan, docSo, fmtGio, fmtNgay, fmtTien, homNay, so, tong, uuid } from '../../lib/tinh'
import { Dang, Huy, Lua, Loi, Modal, Nut, Rong, The, TieuDe, Truong, o } from '../../components/ui'
import { ChonTep, NutTep, moTep, type TepRow } from '../../components/Tep'
import { dongBo, guiTep, themHangDoi } from '../../lib/hangdoi'
import { thongBao } from '../../lib/thongbao'
import { xuatExcel } from '../../lib/excel'
import { useTep } from './DsPhieu'

export type ChiPhiRow = {
  id: string; ngay: string; ten_chi_phi: string; nhom: string; so_tien: number; chung_tu: string; chi_cho: string; ghi_chu: string
  created_by: string; created_at: string; updated_by: string | null; updated_at: string | null; version: number
}
export type LocCP = { tu?: string; den?: string; q?: string; chungTu?: string; thang?: string; nhom?: string; chiCho?: string }
const MAU_CT: Record<string, 'ok' | 'dat' | 'vuot'> = { co_hoa_don: 'ok', hdkv: 'dat', khong_chung_tu: 'vuot' }

export const useChiPhi = (ct: string) => useDuLieu<ChiPhiRow[]>(
  () => supabase.from('chi_phi').select('*').eq('cong_trinh_id', ct).eq('da_xoa', false).order('ngay', { ascending: false }).order('created_at', { ascending: false }).limit(5000) as never,
  [ct], ['chi_phi'], 'cache-cp-' + ct)

type Dong = { k: string; ten: string; tien: string; ct: string | null; cho: string; nhom: string; gc: string; teps: { name: string; blob: Blob }[] }
const dongMoi = (): Dong => ({ k: uuid(), ten: '', tien: '', ct: null, cho: '', nhom: '', gc: '', teps: [] })
const bo = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

export function locCP(ds: ChiPhiRow[], l: LocCP) {
  return ds.filter((r) =>
    (!l.tu || r.ngay >= l.tu) && (!l.den || r.ngay <= l.den) && (!l.chungTu || r.chung_tu === l.chungTu) && (!l.thang || r.ngay.startsWith(l.thang)) &&
    (l.nhom === undefined || (r.nhom.trim() || '(Chưa phân nhóm)') === l.nhom) && (l.chiCho === undefined || (r.chi_cho.trim() || '(Không ghi)') === l.chiCho) &&
    (!l.q || bo(`${r.ten_chi_phi} ${r.chi_cho} ${r.ghi_chu} ${r.nhom}`).includes(bo(l.q))))
}

export function DsChiPhi({ ct, ds, tai, goc = false, ten = 'chi-phi' }: { ct: string; ds: ChiPhiRow[]; tai: () => void; goc?: boolean; ten?: string }) {
  const { ho, isAdmin, nguoi } = useAuth()
  const tep = useTep(ct, 'chi_phi')
  const [sua, setSua] = useState<ChiPhiRow | null>(null)
  const xoa = async (r: ChiPhiRow) => {
    if (!confirm(`Xóa khoản chi “${r.ten_chi_phi}” ${fmtTien(r.so_tien)} đ?`)) return
    const { error, count } = await supabase.from('chi_phi').update({ da_xoa: true }, { count: 'exact' }).eq('id', r.id).eq('version', r.version)
    if (error) return thongBao(error.message, 'loi')
    if (!count) return thongBao('Khoản chi đã được người khác thay đổi, hãy tải lại', 'loi')
    thongBao('Đã xóa khoản chi'); tai()
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-slate-600">{ds.length} khoản · Tổng <b className="num text-brand">{fmtTien(tong(ds.map((r) => so(r.so_tien))))}</b> đ</div>
        <Nut mau="phu" className="min-h-10 px-3 text-sm" onClick={() => xuatExcel(ten, 'Chi phí công trình', [{
          ten: 'Chi phí', cot: [{ tieuDe: 'Ngày', khoa: 'ngay' }, { tieuDe: 'Tên chi phí', khoa: 'ten', rong: 28 }, { tieuDe: 'Nhóm', khoa: 'nhom', rong: 16 }, { tieuDe: 'Số tiền', khoa: 'tien', dinhDang: 'tien' },
            { tieuDe: 'Chứng từ', khoa: 'ct', rong: 20 }, { tieuDe: 'Chi cho', khoa: 'cho', rong: 20 }, { tieuDe: 'Ghi chú', khoa: 'gc', rong: 24 }, { tieuDe: 'Người nhập', khoa: 'nn', rong: 18 }, { tieuDe: 'Giờ nhập', khoa: 'gio', rong: 18 }],
          dong: ds.map((r) => ({ ngay: fmtNgay(r.ngay), ten: r.ten_chi_phi, nhom: r.nhom, tien: so(r.so_tien), ct: CHUNG_TU[r.chung_tu], cho: r.chi_cho, gc: r.ghi_chu, nn: nguoi[r.created_by] ?? '', gio: fmtGio(r.created_at) })),
          tongDong: { ten: 'TỔNG', tien: tong(ds.map((r) => so(r.so_tien))) },
        }])}>⬇ Excel</Nut>
      </div>
      {!ds.length && <Rong t="Không có khoản chi nào" />}
      {ds.map((r) => {
        const quyen = isAdmin || r.created_by === ho?.id
        return (
          <div key={r.id} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-2"><div><b className="text-brand">{r.ten_chi_phi}</b> <span className="text-slate-500">· {fmtNgay(r.ngay)}</span></div><Huy loai={MAU_CT[r.chung_tu]}>{CHUNG_TU[r.chung_tu]}</Huy></div>
            <div className="text-lg font-bold num">{fmtTien(r.so_tien)} đ</div>
            <div className="text-sm text-slate-600">{r.chi_cho && `Chi cho: ${r.chi_cho}`}{r.nhom && ` · Nhóm: ${r.nhom}`}</div>
            {r.ghi_chu && <div className="text-sm text-slate-600">📝 {r.ghi_chu}</div>}
            <div className="mt-1 text-xs text-slate-500">Nhập bởi {nguoi[r.created_by] ?? '…'} lúc {fmtGio(r.created_at)}{r.updated_at ? ` · sửa bởi ${nguoi[r.updated_by ?? ''] ?? '…'} lúc ${fmtGio(r.updated_at)}` : ''}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2"><NutTep teps={tep.get(r.id)} />
              {!goc && quyen && <><Nut mau="phu" className="ml-auto min-h-10 px-3 text-sm" onClick={() => setSua(r)}>Sửa</Nut><Nut mau="do" className="min-h-10 px-3 text-sm" onClick={() => xoa(r)}>Xóa</Nut></>}</div>
          </div>
        )
      })}
      {sua && <SuaCP r={sua} ct={ct} tep={tep.get(sua.id) ?? []} dong={() => setSua(null)} xong={() => { setSua(null); tai() }} />}
    </div>
  )
}

function SuaCP({ r, ct, tep, dong, xong }: { r: ChiPhiRow; ct: string; tep: TepRow[]; dong: () => void; xong: () => void }) {
  const { isAdmin, ho } = useAuth()
  const [f, setF] = useState({ ngay: r.ngay, ten: r.ten_chi_phi, tien: String(r.so_tien), ct: r.chung_tu as string | null, cho: r.chi_cho, nhom: r.nhom, gc: r.ghi_chu })
  const [moi, setMoi] = useState<{ name: string; blob: Blob }[]>([]); const [loi, setLoi] = useState(''); const [ban, setBan] = useState(false)
  const luu = async () => {
    const t = docSo(f.tien)
    if (!f.ten.trim() || !(t > 0) || !f.ct) return setLoi('Nhập tên chi phí, số tiền > 0 và chọn tình trạng chứng từ')
    setBan(true); setLoi('')
    const { error, count } = await supabase.from('chi_phi').update({ ngay: f.ngay, ten_chi_phi: f.ten.trim(), so_tien: t, chung_tu: f.ct, chi_cho: f.cho, nhom: f.nhom, ghi_chu: f.gc }, { count: 'exact' }).eq('id', r.id).eq('version', r.version)
    if (error) { setBan(false); return setLoi(error.message) }
    if (!count) { setBan(false); return setLoi('Khoản chi vừa được người khác sửa. Đóng lại để xem bản mới nhất.') }
    try { if (moi.length) await guiTep(ho!.id, 'chi_phi', ct, r.id, moi, tep.length + 100) } catch (e) { setBan(false); return setLoi('Đã lưu nhưng tải tệp lỗi: ' + (e as Error).message) }
    setBan(false); thongBao('Đã sửa khoản chi'); xong()
  }
  return (
    <Modal tieuDe="Sửa khoản chi" dong={dong}>
      <div className="space-y-3">
        <Truong nhan="Ngày"><input type="date" className={o} value={f.ngay} onChange={(e) => setF({ ...f, ngay: e.target.value })} /></Truong>
        <Truong nhan="Tên chi phí"><input className={o} value={f.ten} onChange={(e) => setF({ ...f, ten: e.target.value })} /></Truong>
        <Truong nhan="Nhóm chi phí"><input className={o} value={f.nhom} onChange={(e) => setF({ ...f, nhom: e.target.value })} /></Truong>
        <Truong nhan="Số tiền"><input className={o} inputMode="decimal" value={f.tien} onChange={(e) => setF({ ...f, tien: e.target.value })} /></Truong>
        <Truong nut nhan="Chứng từ"><Chung gt={f.ct} doi={(v) => setF({ ...f, ct: v })} /></Truong>
        <Truong nhan="Chi cho ai"><input className={o} value={f.cho} onChange={(e) => setF({ ...f, cho: e.target.value })} /></Truong>
        <Truong nhan="Ghi chú"><input className={o} value={f.gc} onChange={(e) => setF({ ...f, gc: e.target.value })} /></Truong>
        {tep.map((t) => <div key={t.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"><button className="text-blue-800" onClick={() => moTep(t.duong_dan)}>📎 {t.ten_tep || 'Tệp'}</button>
          {isAdmin && <button className="text-bad" onClick={async () => { if (!confirm('Xóa tệp này?')) return; await supabase.storage.from('chung-tu').remove([t.duong_dan]); await supabase.from('tep_dinh_kem').delete().eq('id', t.id); xong() }}>Xóa</button>}</div>)}
        <ChonTep teps={moi} doi={setMoi} /><Loi t={loi} />
        <Nut className="w-full" disabled={ban} onClick={luu}>{ban ? 'Đang lưu…' : 'Lưu thay đổi'}</Nut>
      </div>
    </Modal>
  )
}
const Chung = ({ gt, doi }: { gt: string | null; doi: (v: string) => void }) => (
  <Lua gt={gt} doi={doi} mục={[{ v: 'co_hoa_don', t: 'Có HĐ/chứng từ', c: 'bg-ok text-white border-ok' }, { v: 'hdkv', t: 'HĐKV', c: 'bg-warn text-white border-warn' }, { v: 'khong_chung_tu', t: 'Không chứng từ', c: 'bg-bad text-white border-bad' }]} />
)

export default function ChiPhi({ ct }: { ct: string }) {
  const { ho } = useAuth()
  const q = useChiPhi(ct)
  const [ngay, setNgay] = useState(homNay()); const [dongs, setDongs] = useState<Dong[]>([dongMoi()])
  const [loi, setLoi] = useState(''); const [ban, setBan] = useState(false)
  const [loc, setLoc] = useState<LocCP>({ tu: homNay(), den: homNay() }); const [xem, setXem] = useState(false)
  const ds = q.data ?? []
  const nhoms = useMemo(() => [...new Set(ds.map((r) => r.nhom.trim()).filter(Boolean))], [ds])
  const chos = useMemo(() => [...new Set(ds.map((r) => r.chi_cho.trim()).filter(Boolean))], [ds])
  const sua = (k: string, p: Partial<Dong>) => setDongs((a) => a.map((d) => (d.k === k ? { ...d, ...p } : d)))
  if (q.dangTai) return <Dang />
  const luu = async () => {
    setLoi('')
    for (const [i, d] of dongs.entries()) {
      const n = `Dòng ${i + 1}: `
      if (!d.ten.trim()) return setLoi(n + 'chưa nhập tên chi phí')
      if (!(docSo(d.tien) > 0)) return setLoi(n + 'số tiền phải lớn hơn 0')
      if (!d.ct) return setLoi(n + 'BẮT BUỘC chọn tình trạng chứng từ')
    }
    setBan(true)
    for (const d of dongs) {
      const id = uuid()
      await themHangDoi({ id, uid: ho!.id, loai: 'chi_phi', congTrinhId: ct, teps: d.teps,
        hang: { id, client_id: id, cong_trinh_id: ct, ngay, ten_chi_phi: d.ten.trim(), nhom: d.nhom.trim(), so_tien: docSo(d.tien), chung_tu: d.ct, chi_cho: d.cho.trim(), ghi_chu: d.gc, created_by: ho!.id } })
    }
    const r = await dongBo(ho!.id); setBan(false)
    thongBao(r.con ? `Đã lưu ${dongs.length} khoản trên máy — sẽ tự gửi khi có Internet` : `Đã lưu ${dongs.length} khoản chi`, r.con ? 'canhbao' : 'ok')
    setDongs([dongMoi()])
  }
  return (
    <div className="space-y-4">
      <TieuDe>Nhập chi phí hàng ngày</TieuDe>
      <The className="space-y-4">
        <datalist id="dl-nhom">{nhoms.map((n) => <option key={n} value={n} />)}</datalist><datalist id="dl-cho">{chos.map((n) => <option key={n} value={n} />)}</datalist>
        <Truong nhan="Ngày"><input type="date" className={o} value={ngay} onChange={(e) => setNgay(e.target.value)} /></Truong>
        {dongs.map((d, i) => (
          <div key={d.k} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between"><b className="text-brand">Khoản {i + 1}</b>{dongs.length > 1 && <button className="h-10 px-2 text-bad" onClick={() => setDongs((a) => a.filter((x) => x.k !== d.k))}>✕ Bỏ</button>}</div>
            <Truong nhan="Tên chi phí *"><input className={o} value={d.ten} onChange={(e) => sua(d.k, { ten: e.target.value })} /></Truong>
            <div className="grid grid-cols-2 gap-2">
              <Truong nhan="Số tiền (đồng) *"><input className={o} inputMode="decimal" value={d.tien} onChange={(e) => sua(d.k, { tien: e.target.value })} /></Truong>
              <Truong nhan="Nhóm chi phí"><input className={o} list="dl-nhom" value={d.nhom} onChange={(e) => sua(d.k, { nhom: e.target.value })} placeholder="tự đặt" /></Truong>
            </div>
            <Truong nut nhan="Tình trạng chứng từ *"><Chung gt={d.ct} doi={(v) => sua(d.k, { ct: v })} /></Truong>
            <Truong nhan="Chi cho ai"><input className={o} list="dl-cho" value={d.cho} onChange={(e) => sua(d.k, { cho: e.target.value })} /></Truong>
            <Truong nhan="Ghi chú"><input className={o} value={d.gc} onChange={(e) => sua(d.k, { gc: e.target.value })} /></Truong>
            <ChonTep teps={d.teps} doi={(t) => sua(d.k, { teps: t })} />
          </div>
        ))}
        <Nut mau="phu" className="w-full" onClick={() => setDongs((a) => [...a, dongMoi()])}>＋ Thêm khoản chi khác</Nut>
        <div className="text-lg">Tổng: <b className="num text-brand">{fmtTien(tong(dongs.map((d) => docSo(d.tien) || 0)))}</b> đ</div>
        <Loi t={loi} /><Nut mau="vang" className="w-full text-lg" disabled={ban} onClick={luu}>{ban ? 'Đang lưu…' : '💾 LƯU CHI PHÍ'}</Nut>
      </The>
      <TieuDe phai={<Nut mau="phu" className="min-h-10 px-3 text-sm" onClick={() => setXem(!xem)}>{xem ? 'Thu gọn' : '🔍 Lọc'}</Nut>}>Lịch sử chi phí</TieuDe>
      {xem && (
        <div className="space-y-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
          <div className="flex flex-wrap gap-2">
            <Nut mau="xam" className="min-h-10 px-3 text-sm" onClick={() => setLoc({ ...loc, tu: homNay(), den: homNay() })}>Hôm nay</Nut>
            <Nut mau="xam" className="min-h-10 px-3 text-sm" onClick={() => setLoc({ ...loc, tu: dauTuan(), den: homNay() })}>Tuần này</Nut>
            <Nut mau="xam" className="min-h-10 px-3 text-sm" onClick={() => setLoc({ ...loc, tu: dauThang(), den: homNay() })}>Tháng này</Nut>
            <Nut mau="xam" className="min-h-10 px-3 text-sm" onClick={() => setLoc({})}>Tất cả</Nut>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" className={o} value={loc.tu ?? ''} onChange={(e) => setLoc({ ...loc, tu: e.target.value || undefined })} />
            <input type="date" className={o} value={loc.den ?? ''} onChange={(e) => setLoc({ ...loc, den: e.target.value || undefined })} />
          </div>
          <input className={o} placeholder="🔍 Tìm nội dung / người nhận…" value={loc.q ?? ''} onChange={(e) => setLoc({ ...loc, q: e.target.value || undefined })} />
          <select className={o} value={loc.chungTu ?? ''} onChange={(e) => setLoc({ ...loc, chungTu: e.target.value || undefined })}><option value="">Mọi loại chứng từ</option>{Object.entries(CHUNG_TU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
      )}
      <DsChiPhi ct={ct} ds={locCP(ds, loc)} tai={q.tai} />
    </div>
  )
}
