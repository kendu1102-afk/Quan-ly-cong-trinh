import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useDuLieu } from '../../lib/dulieu'
import { CHUNG_TU, fmtTien, so, tong } from '../../lib/tinh'
import { Dang, Modal, Nut, Rong, The, TieuDe } from '../../components/ui'
import { CotNhom, Duong, MAU_BD, Tron } from '../../components/Bieudo'
import { xuatExcel } from '../../lib/excel'
import { DsChiPhi, locCP, useChiPhi, type LocCP } from './ChiPhi'

type Nhom = { nhom: string; tong: number; so_khoan: number }
type Nhan = { chi_cho: string; tong: number; so_khoan: number }

export default function THCP({ ct }: { ct: string }) {
  const q = useChiPhi(ct)
  const nh = useDuLieu<Nhom[]>(() => supabase.from('v_chi_phi_theo_nhom').select('*').eq('cong_trinh_id', ct).order('tong', { ascending: false }) as never, [ct], ['chi_phi'])
  const nn = useDuLieu<Nhan[]>(() => supabase.from('v_chi_phi_theo_nguoi_nhan').select('*').eq('cong_trinh_id', ct).order('tong', { ascending: false }) as never, [ct], ['chi_phi'])
  const [dv, setDv] = useState<'ngay' | 'thang' | 'nam'>('thang')
  const [chiTiet, setChiTiet] = useState<{ tieuDe: string; loc: LocCP } | null>(null)
  const ds = q.data ?? []
  const len = dv === 'ngay' ? 10 : dv === 'thang' ? 7 : 4
  const theoKy = useMemo(() => {
    const m = new Map<string, { ky: string; a: number; b: number; c: number }>()
    for (const r of ds) {
      const k = r.ngay.slice(0, len); const x = m.get(k) ?? { ky: k, a: 0, b: 0, c: 0 }
      if (r.chung_tu === 'co_hoa_don') x.a += so(r.so_tien); else if (r.chung_tu === 'hdkv') x.b += so(r.so_tien); else x.c += so(r.so_tien)
      m.set(k, x)
    }
    return [...m.values()].sort((a, b) => a.ky.localeCompare(b.ky)).map((x) => ({ ...x, tong: x.a + x.b + x.c }))
  }, [ds, len])
  if (q.dangTai) return <Dang />
  if (!ds.length) return <Rong t="Chưa có khoản chi nào." />
  const loai = (c: string) => tong(ds.filter((r) => r.chung_tu === c).map((r) => so(r.so_tien)))
  const T = tong(ds.map((r) => so(r.so_tien)))
  const mo = (tieuDe: string, loc: LocCP) => setChiTiet({ tieuDe, loc })
  const kyLoc = (ky: string): LocCP => (dv === 'ngay' ? { tu: ky, den: ky } : dv === 'thang' ? { thang: ky } : { tu: `${ky}-01-01`, den: `${ky}-12-31` })
  return (
    <div className="space-y-4">
      <TieuDe phai={<Nut mau="phu" className="min-h-10 px-3 text-sm" onClick={() => xuatExcel('tong-hop-chi-phi', 'Tổng hợp chi phí', [
        { ten: 'Tổng hợp', cot: [{ tieuDe: 'Chỉ tiêu', khoa: 'a', rong: 30 }, { tieuDe: 'Số tiền', khoa: 'b', dinhDang: 'tien' }],
          dong: [{ a: 'Tổng chi phí', b: T }, { a: 'Có hóa đơn/chứng từ', b: loai('co_hoa_don') }, { a: 'HĐKV', b: loai('hdkv') }, { a: 'Không chứng từ', b: loai('khong_chung_tu') }] },
        { ten: 'Theo tháng', cot: [{ tieuDe: 'Tháng', khoa: 'k' }, { tieuDe: 'Có HĐ/CT', khoa: 'a', dinhDang: 'tien' }, { tieuDe: 'HĐKV', khoa: 'b', dinhDang: 'tien' }, { tieuDe: 'Không CT', khoa: 'c', dinhDang: 'tien' }, { tieuDe: 'Tổng', khoa: 't', dinhDang: 'tien' }],
          dong: Object.values(ds.reduce((m, r) => { const k = r.ngay.slice(0, 7); const x = m[k] ?? { k, a: 0, b: 0, c: 0, t: 0 }; const v = so(r.so_tien); x.t += v; if (r.chung_tu === 'co_hoa_don') x.a += v; else if (r.chung_tu === 'hdkv') x.b += v; else x.c += v; m[k] = x; return m }, {} as Record<string, { k: string; a: number; b: number; c: number; t: number }>)).sort((x, y) => x.k.localeCompare(y.k)) },
        { ten: 'Theo nhóm', cot: [{ tieuDe: 'Nhóm', khoa: 'n', rong: 26 }, { tieuDe: 'Số khoản', khoa: 'k' }, { tieuDe: 'Số tiền', khoa: 't', dinhDang: 'tien' }], dong: (nh.data ?? []).map((x) => ({ n: x.nhom, k: x.so_khoan, t: so(x.tong) })) },
        { ten: 'Theo người nhận', cot: [{ tieuDe: 'Chi cho', khoa: 'n', rong: 26 }, { tieuDe: 'Số khoản', khoa: 'k' }, { tieuDe: 'Số tiền', khoa: 't', dinhDang: 'tien' }], dong: (nn.data ?? []).map((x) => ({ n: x.chi_cho, k: x.so_khoan, t: so(x.tong) })) },
      ])}>⬇ Excel</Nut>}>Tổng hợp chi phí</TieuDe>
      <div className="grid grid-cols-2 gap-3">
        <button className="text-left" onClick={() => mo('Tất cả khoản chi', {})}><The><div className="text-sm text-slate-500">Tổng chi phí phát sinh</div><div className="text-xl font-bold num">{fmtTien(T)}</div></The></button>
        {(['co_hoa_don', 'hdkv', 'khong_chung_tu'] as const).map((c) => (
          <button key={c} className="text-left" onClick={() => mo(CHUNG_TU[c], { chungTu: c })}><The><div className="text-sm text-slate-500">{CHUNG_TU[c]}</div><div className={`text-xl font-bold num ${c === 'co_hoa_don' ? 'text-ok' : c === 'hdkv' ? 'text-warn' : 'text-bad'}`}>{fmtTien(loai(c))}</div></The></button>
        ))}
      </div>
      <The>
        <div className="mb-2 flex items-center justify-between"><h3 className="font-bold text-brand">Biểu đồ chi phí (bấm để xem chi tiết)</h3>
          <div className="flex gap-1">{(['ngay', 'thang', 'nam'] as const).map((k) => <Nut key={k} mau={dv === k ? 'chinh' : 'xam'} className="min-h-10 px-3 text-sm" onClick={() => setDv(k)}>{k === 'ngay' ? 'Ngày' : k === 'thang' ? 'Tháng' : 'Năm'}</Nut>)}</div></div>
        {dv === 'ngay'
          ? <Duong x="ky" du_lieu={theoKy} chuoi={[{ khoa: 'tong', ten: 'Chi phí', mau: MAU_BD.xanh }]} chon={(h) => mo(`Chi ngày ${h.ky}`, kyLoc(String(h.ky)))} />
          : <CotNhom x="ky" du_lieu={theoKy} xepChong chuoi={[{ khoa: 'a', ten: 'Có HĐ/CT', mau: MAU_BD.luc }, { khoa: 'b', ten: 'HĐKV', mau: MAU_BD.cam }, { khoa: 'c', ten: 'Không CT', mau: MAU_BD.do }]}
              chon={(h, k) => mo(`Chi ${dv === 'thang' ? 'tháng' : 'năm'} ${h.ky}`, { ...kyLoc(String(h.ky)), chungTu: k === 'a' ? 'co_hoa_don' : k === 'b' ? 'hdkv' : 'khong_chung_tu' })} />}
      </The>
      <The><h3 className="mb-1 font-bold text-brand">Cơ cấu theo chứng từ</h3>
        <Tron chon={(k) => mo(CHUNG_TU[k], { chungTu: k })} du_lieu={[{ ten: 'Có HĐ/CT', gia_tri: loai('co_hoa_don'), mau: MAU_BD.luc, khoa: 'co_hoa_don' }, { ten: 'HĐKV', gia_tri: loai('hdkv'), mau: MAU_BD.cam, khoa: 'hdkv' }, { ten: 'Không CT', gia_tri: loai('khong_chung_tu'), mau: MAU_BD.do, khoa: 'khong_chung_tu' }]} /></The>
      <The>
        <h3 className="mb-2 font-bold text-brand">Theo nhóm chi phí</h3>
        {(nh.data ?? []).map((x) => <button key={x.nhom} onClick={() => mo(`Nhóm: ${x.nhom}`, { nhom: x.nhom })} className="flex w-full justify-between border-b py-2 text-left active:bg-slate-100"><span>{x.nhom} <span className="text-slate-500">({x.so_khoan})</span></span><b className="num">{fmtTien(x.tong)}</b></button>)}
      </The>
      <The>
        <h3 className="mb-2 font-bold text-brand">Theo người nhận tiền</h3>
        {(nn.data ?? []).map((x) => <button key={x.chi_cho} onClick={() => mo(`Chi cho: ${x.chi_cho}`, { chiCho: x.chi_cho })} className="flex w-full justify-between border-b py-2 text-left active:bg-slate-100"><span>{x.chi_cho} <span className="text-slate-500">({x.so_khoan})</span></span><b className="num">{fmtTien(x.tong)}</b></button>)}
      </The>
      {chiTiet && <Modal tieuDe={chiTiet.tieuDe} dong={() => setChiTiet(null)}><DsChiPhi ct={ct} ds={locCP(ds, chiTiet.loc)} tai={q.tai} goc ten="chi-tiet-chi-phi" /></Modal>}
    </div>
  )
}
