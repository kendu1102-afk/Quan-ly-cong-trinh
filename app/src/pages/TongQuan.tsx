import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useDuLieu } from '../lib/dulieu'
import { useCT } from '../lib/ct'
import { fmtSo, fmtTien, so, tong } from '../lib/tinh'
import { Dang, Huy, The, TieuDe } from '../components/ui'
import { useCanhBao } from '../components/CanhBao'
import ChonCongTrinh from '../components/ChonCongTrinh'

type TQ = { cong_trinh_id: string; ten: string; luu_tru: boolean; trang_thai: string; gia_tri_hop_dong: number; vt_tong: number; cp_tong: number }
export const NGUONG_CANH_BAO_CHI_PHI = 70   // % chi phí so với giá trị hợp đồng

export default function TongQuan() {
  const { ds, chon } = useCT()
  const nav = useNavigate()
  const [chonDich, setChonDich] = useState<null | 'nhap-vt' | 'chi-phi'>(null)
  const q = useDuLieu<TQ[]>(() => supabase.from('v_tong_quan_cong_trinh').select('cong_trinh_id,ten,luu_tru,trang_thai,gia_tri_hop_dong,vt_tong,cp_tong') as never, [], ['phieu_nhap_vt', 'chi_phi', 'cong_trinh'], 'cache-tq')
  const cb = useCanhBao()
  const tenCT = (id: string) => ds.find((c) => c.id === id)?.ten ?? '(công trình)'
  const hd = (q.data ?? []).filter((x) => !x.luu_tru)
  // Công trình đang thực hiện mà tổng chi phí đã đạt từ 70% giá trị hợp đồng trở lên
  const canhBaoCP = hd
    .filter((x) => x.trang_thai !== 'hoan_thanh' && so(x.gia_tri_hop_dong) > 0)
    .map((x) => ({ ...x, tyle: (so(x.cp_tong) / so(x.gia_tri_hop_dong)) * 100 }))
    .filter((x) => x.tyle >= NGUONG_CANH_BAO_CHI_PHI)
    .sort((a, b) => b.tyle - a.tyle)
  const vao = (dich: 'nhap-vt' | 'chi-phi') => {
    const dang = ds.filter((c) => !c.luu_tru)
    if (dang.length === 1) { chon(dang[0].id); nav(`/ct/${dang[0].id}/${dich}`) } else setChonDich(dich)
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link to="/ct" className="tile tile-lon"><span className="tile-bd">🏗️</span>Danh sách công trình</Link>
        <button type="button" onClick={() => vao('nhap-vt')} className="tile tile-lon"><span className="tile-bd">🧱</span>Nhập vật tư</button>
        <button type="button" onClick={() => vao('chi-phi')} className="tile tile-lon"><span className="tile-bd">💵</span>Nhập chi phí</button>
      </div>
      <TieuDe>Tổng quan</TieuDe>
      {q.dangTai ? <Dang /> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="kpi"><div className="text-sm text-slate-500">Công trình đang quản lý</div><div className="text-2xl font-bold num text-brand">{hd.length}</div></div>
          <div className="kpi"><div className="text-sm text-slate-500">Tổng giá trị hợp đồng</div><div className="text-xl font-bold num text-brand">{fmtTien(tong(hd.map((x) => so(x.gia_tri_hop_dong))))}</div></div>
          <div className="kpi"><div className="text-sm text-slate-500">Tổng vật tư đã nhập</div><div className="text-xl font-bold num text-brand">{fmtTien(tong(hd.map((x) => so(x.vt_tong))))}</div></div>
          <div className="kpi"><div className="text-sm text-slate-500">Tổng chi phí</div><div className="text-xl font-bold num text-brand">{fmtTien(tong(hd.map((x) => so(x.cp_tong))))}</div></div>
        </div>
      )}
      <The>
        <h3 className="mb-2 text-lg font-bold text-brand">⚠ Cảnh báo vật tư đạt / vượt dự toán</h3>
        {!cb.data?.length ? <p className="text-slate-500">Hiện không có vật tư nào đạt hoặc vượt dự toán.</p> : (
          <div className="space-y-2">
            {cb.data.map((r) => (
              <Link key={r.vat_tu_id} to={`/ct/${r.cong_trinh_id}/th-vt`} className={`block rounded-xl p-3 ${r.canh_bao === 'vuot' ? 'bg-red-50 ring-1 ring-red-300' : 'bg-amber-50 ring-1 ring-amber-300'}`}>
                <div className="font-extrabold text-brand">🏗️ {tenCT(r.cong_trinh_id)}</div>
                <div className="mt-1 flex items-center justify-between gap-2"><b>{r.ten}</b><Huy loai={r.canh_bao}>{r.canh_bao === 'vuot' ? `VƯỢT ${fmtSo(r.kl_vuot)} ${r.dvt}` : 'ĐÃ ĐẠT DỰ TOÁN'}</Huy></div>
                <div className="text-sm num">Dự toán {fmtSo(r.khoi_luong_dt)} · Đã nhập {fmtSo(r.kl_thuc_te)} · {r.canh_bao === 'vuot' ? `Vượt ${fmtSo(r.kl_vuot)}` : 'Còn lại 0'} {r.dvt}</div>
              </Link>
            ))}
          </div>
        )}
      </The>
      <The>
        <h3 className="mb-2 text-lg font-bold text-brand">⚠ Cảnh báo chi phí đạt {NGUONG_CANH_BAO_CHI_PHI}% giá trị hợp đồng</h3>
        {!canhBaoCP.length ? <p className="text-slate-500">Hiện không có công trình nào có chi phí từ {NGUONG_CANH_BAO_CHI_PHI}% giá trị hợp đồng trở lên.</p> : (
          <div className="space-y-2">
            {canhBaoCP.map((x) => {
              const vuot = x.tyle >= 100
              return (
                <Link key={x.cong_trinh_id} to={`/ct/${x.cong_trinh_id}/th-cp`} className={`block rounded-xl p-3 ${vuot ? 'bg-red-50 ring-1 ring-red-300' : 'bg-amber-50 ring-1 ring-amber-300'}`}>
                  <div className="flex items-start justify-between gap-2"><div className="font-extrabold text-brand">🏗️ {x.ten}</div><Huy loai={vuot ? 'vuot' : 'dat'}>{vuot ? 'VƯỢT HỢP ĐỒNG' : `${x.tyle.toFixed(1)}%`}</Huy></div>
                  <div className="mt-1 text-sm num">Chi phí <b>{fmtTien(x.cp_tong)}</b> / Hợp đồng <b>{fmtTien(x.gia_tri_hop_dong)}</b> đ = <b className={vuot ? 'text-bad' : 'text-warn'}>{x.tyle.toFixed(1)}%</b></div>
                  <div className="thanh-tien mt-2"><i style={{ width: `${Math.min(x.tyle, 100)}%`, background: vuot ? '#b91c1c' : 'linear-gradient(90deg,#d4a017,#f5c542)' }} /></div>
                </Link>
              )
            })}
          </div>
        )}
      </The>
      {chonDich && <ChonCongTrinh tieuDe={chonDich === 'nhap-vt' ? 'Nhập vật tư cho công trình nào?' : 'Nhập chi phí cho công trình nào?'} dong={() => setChonDich(null)} chon={(id) => { chon(id); nav(`/ct/${id}/${chonDich}`) }} />}
    </div>
  )
}
