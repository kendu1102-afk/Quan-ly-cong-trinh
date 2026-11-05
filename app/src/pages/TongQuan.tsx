import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useDuLieu } from '../lib/dulieu'
import { useAuth } from '../lib/auth'
import { useCT } from '../lib/ct'
import { fmtSo, fmtTien, so, tong } from '../lib/tinh'
import { Dang, Huy, The, TieuDe } from '../components/ui'
import { useCanhBao } from '../components/CanhBao'

type TQ = { cong_trinh_id: string; ten: string; luu_tru: boolean; gia_tri_hop_dong: number; vt_tong: number; cp_tong: number }

export default function TongQuan() {
  const { isAdmin } = useAuth()
  const { cur, ds } = useCT()
  const q = useDuLieu<TQ[]>(() => supabase.from('v_tong_quan_cong_trinh').select('cong_trinh_id,ten,luu_tru,gia_tri_hop_dong,vt_tong,cp_tong') as never, [], ['phieu_nhap_vt', 'chi_phi', 'cong_trinh'], 'cache-tq')
  const cb = useCanhBao()
  const tenCT = (id: string) => ds.find((c) => c.id === id)?.ten ?? ''
  const hd = (q.data ?? []).filter((x) => !x.luu_tru)
  const base = cur ? `/ct/${cur}` : '/ct'
  const tiles: [string, string, string][] = [
    ['📊', 'Tổng quan', '/'], ['🏗️', 'Danh sách công trình', '/ct'], ['🧱', 'Nhập vật tư', `${base}/nhap-vt`], ['💵', 'Nhập chi phí', `${base}/chi-phi`],
    ['📦', 'Tổng hợp vật tư', `${base}/th-vt`], ['📈', 'Tổng hợp chi phí', `${base}/th-cp`],
    ...(isAdmin ? [['🧰', 'Nhập vật tư mẫu', '/vat-tu-mau'], ['🗓️', 'Báo cáo theo năm', '/bao-cao'], ['👥', 'Quản lý tài khoản', '/tai-khoan']] as [string, string, string][] : []),
  ]
  return (
    <div className="space-y-4">
      <TieuDe>Tổng quan</TieuDe>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.slice(1).map(([bd, t, to]) => (
          <Link key={t} to={to} className="tile"><span className="tile-bd">{bd}</span>{t}</Link>
        ))}
      </div>
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
                <div className="flex items-center justify-between"><b>{r.ten}</b><Huy loai={r.canh_bao}>{r.canh_bao === 'vuot' ? `VƯỢT ${fmtSo(r.kl_vuot)} ${r.dvt}` : 'ĐÃ ĐẠT DỰ TOÁN'}</Huy></div>
                <div className="text-sm text-slate-600">{tenCT(r.cong_trinh_id)}</div>
                <div className="text-sm num">Dự toán {fmtSo(r.khoi_luong_dt)} · Đã nhập {fmtSo(r.kl_thuc_te)} · {r.canh_bao === 'vuot' ? `Vượt ${fmtSo(r.kl_vuot)}` : 'Còn lại 0'} {r.dvt}</div>
              </Link>
            ))}
          </div>
        )}
      </The>
    </div>
  )
}
