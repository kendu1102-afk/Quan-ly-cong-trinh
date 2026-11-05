import { fmtTien } from '../lib/tinh'

/** Khối "giá trị đã thực hiện / giá trị hợp đồng = %" kèm thanh tiến độ */
export default function TienDoThucHien({ gtThucHien, mau, tyLe, phu }: { gtThucHien: number; mau: number; tyLe: number; phu?: string }) {
  return (
    <div className="kpi">
      <div className="text-sm text-slate-600">Giá trị đã thực hiện / Giá trị hợp đồng</div>
      <div className="num mt-1 text-lg font-bold text-brand">{fmtTien(gtThucHien)} <span className="font-medium text-slate-500">/ {fmtTien(mau)} đ</span></div>
      <div className="mt-2 flex items-center gap-3">
        <div className="thanh-tien flex-1"><i style={{ width: `${Math.min(tyLe, 100)}%`, background: 'linear-gradient(90deg,#15803d,#4ade80)' }} /></div>
        <b className="num text-xl text-ok">{tyLe.toFixed(1)}%</b>
      </div>
      {phu && <div className="mt-1 text-xs text-slate-500">{phu}</div>}
    </div>
  )
}
