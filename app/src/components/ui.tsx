import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

const MAU: Record<string, string> = {
  chinh: 'bg-gradient-to-b from-brand-2 to-brand text-white shadow-md shadow-brand/30 active:from-brand active:to-brand',
  vang: 'bg-gradient-to-b from-gold-2 to-gold text-brand shadow-md shadow-gold/40 active:from-gold active:to-gold',
  phu: 'bg-white text-brand border border-brand/30 active:bg-slate-100',
  do: 'bg-bad text-white active:bg-red-800',
  xam: 'bg-slate-200 text-slate-800 active:bg-slate-300',
}
export function Nut({ mau = 'chinh', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { mau?: keyof typeof MAU }) {
  return <button type="button" {...p} className={`min-h-12 rounded-xl px-4 font-semibold disabled:opacity-50 ${MAU[mau]} ${className}`} />
}
// nut=true: nhóm nút bấm (không bọc bằng <label> để bấm vào chữ không kích hoạt nhầm nút đầu tiên)
export const Truong = ({ nhan, children, className = '', nut = false }: { nhan: string; children: ReactNode; className?: string; nut?: boolean }) => {
  const Tag = nut ? 'div' : 'label'
  return <Tag className={`block ${className}`}><span className="mb-1 block text-sm font-medium text-slate-600">{nhan}</span>{children}</Tag>
}
export const o = 'w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'
export const The = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`the ${className}`}>{children}</div>
)
export const TieuDe = ({ children, phai }: { children: ReactNode; phai?: ReactNode }) => (
  <div className="mb-3 flex items-center justify-between gap-2"><h2 className="tieu-de text-xl font-bold text-brand">{children}</h2>{phai}</div>
)
export function Huy({ loai, children }: { loai: 'ok' | 'dat' | 'vuot' | 'xam' | 'xanh'; children: ReactNode }) {
  const c = { ok: 'bg-green-100 text-green-800', dat: 'bg-amber-100 text-amber-800', vuot: 'bg-red-100 text-red-800', xam: 'bg-slate-100 text-slate-700', xanh: 'bg-blue-100 text-blue-800' }[loai]
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold ${c}`}>{children}</span>
}
export function Modal({ tieuDe, dong, children }: { tieuDe: string; dong: () => void; children: ReactNode }) {
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={dong}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border-t-4 border-gold bg-white p-4 sm:max-w-3xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold text-brand">{tieuDe}</h3>
          <button onClick={dong} className="h-11 w-11 rounded-full bg-slate-100 text-xl" aria-label="Đóng">✕</button></div>
        {children}
      </div>
    </div>
  )
}
export const Dang = ({ t = 'Đang tải…' }: { t?: string }) => <div className="p-6 text-center text-slate-500">{t}</div>
export const Rong = ({ t }: { t: string }) => <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">{t}</div>
export const Loi = ({ t }: { t: string }) => t ? <div className="mb-3 rounded-xl bg-red-50 p-3 text-bad">{t}</div> : null

export function Lua<T extends string | boolean>({ gt, doi, mục }: { gt: T | null; doi: (v: T) => void; mục: { v: T; t: string; c?: string }[] }) {
  return (
    <div className="flex gap-2">
      {mục.map((m) => (
        <button type="button" key={String(m.v)} onClick={() => doi(m.v)}
          className={`min-h-12 flex-1 rounded-xl border px-2 font-semibold ${gt === m.v ? (m.c ?? 'bg-brand text-white border-gold') : 'bg-white text-slate-700 border-slate-300'}`}>
          {m.t}
        </button>
      ))}
    </div>
  )
}

export function ToastHost() {
  const [ds, setDs] = useState<{ id: number; noiDung: string; loai: string }[]>([])
  useEffect(() => {
    const f = (e: Event) => {
      const d = (e as CustomEvent).detail
      setDs((x) => [...x, d]); setTimeout(() => setDs((x) => x.filter((y) => y.id !== d.id)), d.loai === 'ok' ? 3000 : 8000)
    }
    window.addEventListener('toast', f); return () => window.removeEventListener('toast', f)
  }, [])
  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[60] flex flex-col items-center gap-2 px-3">
      {ds.map((t) => (
        <div key={t.id} className={`pointer-events-auto w-full max-w-md rounded-xl px-4 py-3 text-white shadow-lg ${t.loai === 'loi' ? 'bg-bad' : t.loai === 'canhbao' ? 'bg-warn' : 'bg-ok'}`}>{t.noiDung}</div>
      ))}
    </div>
  )
}

/** Ô chọn có tìm kiếm nhanh */
export function ChonTim<T extends { id: string }>({ ds, gt, doi, nhan, hienThi, placeholder }: {
  ds: T[]; gt: string; doi: (id: string) => void; nhan: (x: T) => string; hienThi?: (x: T) => ReactNode; placeholder?: string
}) {
  const [mo, setMo] = useState(false)
  const [q, setQ] = useState('')
  const chon = ds.find((x) => x.id === gt)
  const bo = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
  const loc = ds.filter((x) => bo(nhan(x)).includes(bo(q))).slice(0, 50)
  return (
    <div className="relative">
      <button type="button" className={`${o} text-left ${chon ? '' : 'text-slate-400'}`} onClick={() => { setMo(true); setQ('') }}>
        {chon ? nhan(chon) : placeholder ?? 'Chọn…'}
      </button>
      {mo && (
        <Modal tieuDe={placeholder ?? 'Chọn'} dong={() => setMo(false)}>
          <input autoFocus className={`${o} mb-3`} placeholder="Gõ để tìm…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="space-y-1">
            {loc.map((x) => (
              <button type="button" key={x.id} className={`block min-h-12 w-full rounded-xl px-3 py-2 text-left ${x.id === gt ? 'bg-brand/10 font-bold' : 'bg-slate-50'}`}
                onClick={() => { doi(x.id); setMo(false) }}>{hienThi ? hienThi(x) : nhan(x)}</button>
            ))}
            {!loc.length && <Rong t="Không tìm thấy" />}
          </div>
        </Modal>
      )}
    </div>
  )
}
