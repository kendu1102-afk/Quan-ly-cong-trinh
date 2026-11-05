import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtTien } from '../lib/tinh'

export const MAU_BD = { xanh: '#1c5a8c', cam: '#e08a00', do: '#b91c1c', luc: '#15803d', xam: '#64748b', tim: '#7c3aed' }
const rutGon = (v: number) => (Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(1) + ' tỷ' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(0) + ' tr' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(0) + 'k' : String(v))
const tip = { formatter: (v: unknown) => fmtTien(v) }

type Chuoi = { khoa: string; ten: string; mau: string }
export function CotNhom({ du_lieu, chuoi, x = 'ten', cao = 260, tien = true, xepChong, chon }: {
  du_lieu: Record<string, unknown>[]; chuoi: Chuoi[]; x?: string; cao?: number; tien?: boolean; xepChong?: boolean
  chon?: (hang: Record<string, unknown>, khoa: string) => void
}) {
  return (
    <div style={{ height: cao }}>
      <ResponsiveContainer>
        <BarChart data={du_lieu} margin={{ left: -10, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={x} tick={{ fontSize: 12 }} interval={0} angle={du_lieu.length > 4 ? -30 : 0} textAnchor={du_lieu.length > 4 ? 'end' : 'middle'} height={du_lieu.length > 4 ? 60 : 30} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={tien ? rutGon : undefined} width={52} />
          <Tooltip {...(tien ? tip : {})} />
          <Legend />
          {chuoi.map((c) => (
            <Bar key={c.khoa} dataKey={c.khoa} name={c.ten} fill={c.mau} stackId={xepChong ? 'a' : undefined} radius={xepChong ? 0 : [4, 4, 0, 0]}
              cursor={chon ? 'pointer' : undefined} onClick={chon ? (d) => chon(d.payload as Record<string, unknown>, c.khoa) : undefined} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
export function Duong({ du_lieu, chuoi, x = 'ten', cao = 240, chon }: { du_lieu: Record<string, unknown>[]; chuoi: Chuoi[]; x?: string; cao?: number; chon?: (hang: Record<string, unknown>) => void }) {
  return (
    <div style={{ height: cao }}>
      <ResponsiveContainer>
        <LineChart data={du_lieu} margin={{ left: -10, right: 8, top: 8 }} onClick={chon ? (e) => { const p = (e as { activePayload?: { payload: Record<string, unknown> }[] }).activePayload; if (p?.[0]) chon(p[0].payload) } : undefined}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={x} tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} tickFormatter={rutGon} width={52} />
          <Tooltip {...tip} /><Legend />
          {chuoi.map((c) => <Line key={c.khoa} type="monotone" dataKey={c.khoa} name={c.ten} stroke={c.mau} strokeWidth={2.5} dot={{ r: 3 }} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
export function Tron({ du_lieu, cao = 240, chon }: { du_lieu: { ten: string; gia_tri: number; mau: string; khoa?: string }[]; cao?: number; chon?: (k: string) => void }) {
  const tongSo = du_lieu.reduce((s, d) => s + d.gia_tri, 0)
  if (!tongSo) return <div className="p-6 text-center text-slate-500">Chưa có dữ liệu</div>
  return (
    <div style={{ height: cao }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={du_lieu} dataKey="gia_tri" nameKey="ten" outerRadius="75%" label={(e) => `${Math.round((e.value / tongSo) * 100)}%`} cursor={chon ? 'pointer' : undefined}
            onClick={chon ? (d) => chon((d as { khoa?: string }).khoa ?? '') : undefined}>
            {du_lieu.map((d) => <Cell key={d.ten} fill={d.mau} />)}
          </Pie>
          <Tooltip {...tip} /><Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Biểu đồ Gantt tiến độ công trình trong một năm */
export function Gantt({ nam, hang }: { nam: number; hang: { ten: string; tu?: string | null; den?: string | null; trang_thai: string }[] }) {
  const d0 = Date.UTC(nam, 0, 1), d1 = Date.UTC(nam + 1, 0, 1), tot = d1 - d0
  const co = hang.filter((h) => h.tu && h.den)
  if (!co.length) return <div className="p-6 text-center text-slate-500">Chưa có ngày khởi công/hoàn thành để vẽ tiến độ</div>
  const vi = (s: string) => Math.min(1, Math.max(0, (Date.parse(s) - d0) / tot)) * 100
  const hom = Date.now(); const homPc = hom >= d0 && hom <= d1 ? ((hom - d0) / tot) * 100 : null
  const mau = (t: string) => (t === 'hoan_thanh' ? MAU_BD.luc : t === 'tam_dung' ? MAU_BD.xam : MAU_BD.xanh)
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="ml-36 grid grid-cols-12 border-b text-center text-xs text-slate-500">{Array.from({ length: 12 }, (_, i) => <div key={i}>T{i + 1}</div>)}</div>
        {co.map((h) => {
          const a = vi(h.tu!), b = vi(h.den!)
          return (
            <div key={h.ten} className="flex items-center border-b py-1.5">
              <div className="w-36 shrink-0 truncate pr-2 text-sm font-medium" title={h.ten}>{h.ten}</div>
              <div className="relative h-7 flex-1 bg-slate-50">
                {homPc !== null && <div className="absolute top-0 h-full w-px bg-red-400" style={{ left: `${homPc}%` }} />}
                <div className="absolute top-1 h-5 rounded" style={{ left: `${a}%`, width: `${Math.max(b - a, 0.8)}%`, background: mau(h.trang_thai) }} title={`${h.tu} → ${h.den}`} />
              </div>
            </div>
          )
        })}
        <div className="ml-36 mt-2 flex gap-4 text-xs text-slate-600">
          <span><i className="mr-1 inline-block h-3 w-3 rounded" style={{ background: MAU_BD.xanh }} />Đang thực hiện</span>
          <span><i className="mr-1 inline-block h-3 w-3 rounded" style={{ background: MAU_BD.luc }} />Hoàn thành</span>
          <span><i className="mr-1 inline-block h-3 w-3 rounded" style={{ background: MAU_BD.xam }} />Tạm dừng</span>
          <span><i className="mr-1 inline-block h-3 w-px bg-red-400" />Hôm nay</span>
        </div>
      </div>
    </div>
  )
}
