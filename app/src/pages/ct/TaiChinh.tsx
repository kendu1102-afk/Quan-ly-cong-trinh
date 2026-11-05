import { supabase } from '../../lib/supabase'
import { useDuLieu } from '../../lib/dulieu'
import { fmtTien, so } from '../../lib/tinh'
import { Dang, The, TieuDe } from '../../components/ui'
import { CotNhom, MAU_BD, Tron } from '../../components/Bieudo'

type TQ = { gia_tri_hop_dong: number; vt_tong: number; cp_tong: number; chenh_lech: number; vt_co_hd: number; vt_khong_hd: number; cp_co_hd: number; cp_hdkv: number; cp_khong_ct: number }
export default function TaiChinh({ ct }: { ct: string }) {
  const q = useDuLieu<TQ[]>(() => supabase.from('v_tong_quan_cong_trinh').select('*').eq('cong_trinh_id', ct) as never, [ct], ['phieu_nhap_vt', 'chi_phi', 'cong_trinh'], 'cache-tc-' + ct)
  if (q.dangTai) return <Dang />
  const x = q.data?.[0]; if (!x) return null
  const hd = so(x.gia_tri_hop_dong), vt = so(x.vt_tong), cp = so(x.cp_tong), cl = so(x.chenh_lech)
  return (
    <div className="space-y-4">
      <TieuDe>Tài chính công trình</TieuDe>
      <div className="grid grid-cols-2 gap-3">
        <The><div className="text-sm text-slate-500">Giá trị hợp đồng</div><div className="text-xl font-bold num">{fmtTien(hd)}</div></The>
        <The><div className="text-sm text-slate-500">Vật tư đã nhập</div><div className="text-xl font-bold num">{fmtTien(vt)}</div></The>
        <The><div className="text-sm text-slate-500">Chi phí phát sinh</div><div className="text-xl font-bold num">{fmtTien(cp)}</div></The>
        <The className={cl < 0 ? 'bg-red-50' : 'bg-green-50'}><div className="text-sm text-slate-500">Chênh lệch (HĐ − VT − CP)</div><div className={`text-xl font-bold num ${cl < 0 ? 'text-bad' : 'text-ok'}`}>{fmtTien(cl)}</div>{hd > 0 && <div className="text-sm num">{((cl / hd) * 100).toFixed(1)}% giá trị hợp đồng</div>}</The>
      </div>
      <The><h3 className="mb-1 font-bold text-brand">Hợp đồng so với vật tư và chi phí</h3>
        <CotNhom du_lieu={[{ ten: 'Hợp đồng', v: hd }, { ten: 'Vật tư', v: vt }, { ten: 'Chi phí', v: cp }, { ten: 'Chênh lệch', v: cl }]} chuoi={[{ khoa: 'v', ten: 'Giá trị (đ)', mau: MAU_BD.xanh }]} /></The>
      <The><h3 className="mb-1 font-bold text-brand">Cơ cấu đã ghi nhận (vật tư + chi phí)</h3>
        <Tron du_lieu={[{ ten: 'VT có HĐ', gia_tri: so(x.vt_co_hd), mau: MAU_BD.luc }, { ten: 'VT không HĐ', gia_tri: so(x.vt_khong_hd), mau: MAU_BD.cam }, { ten: 'CP có HĐ/CT', gia_tri: so(x.cp_co_hd), mau: MAU_BD.xanh }, { ten: 'CP HĐKV', gia_tri: so(x.cp_hdkv), mau: MAU_BD.tim }, { ten: 'CP không CT', gia_tri: so(x.cp_khong_ct), mau: MAU_BD.do }]} /></The>
      <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Đây là chỉ số quản lý tham khảo, không phải lợi nhuận kế toán hoặc giá thành hoàn chỉnh (chưa tính các chi phí chưa được ghi nhận trong phần mềm, thuế, khấu hao…).</p>
    </div>
  )
}
