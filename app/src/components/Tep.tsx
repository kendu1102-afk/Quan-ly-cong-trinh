import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { nenTep } from '../lib/image'
import { thongBao } from '../lib/thongbao'

export type TepRow = { id: string; ban_ghi_id: string; duong_dan: string; ten_tep: string }

export async function moTep(path: string) {
  const { data, error } = await supabase.storage.from('chung-tu').createSignedUrl(path, 3600)
  if (error) return thongBao('Không mở được tệp (cần Internet): ' + error.message, 'loi')
  window.open(data.signedUrl, '_blank')
}

/** Chọn ảnh/tệp (có thể chụp trực tiếp bằng máy ảnh). Ảnh được nén trước khi lưu. */
export function ChonTep({ teps, doi }: { teps: { name: string; blob: Blob }[]; doi: (t: { name: string; blob: Blob }[]) => void }) {
  const [ban, setBan] = useState(false)
  return (
    <div>
      <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-brand/40 bg-brand/5 px-3 font-semibold text-brand">
        📎 {ban ? 'Đang xử lý…' : 'Đính kèm ảnh / hóa đơn'}
        <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={async (e) => {
          const fs = Array.from(e.target.files ?? []); e.target.value = ''; setBan(true)
          try { const m = []; for (const f of fs) m.push({ name: f.name, blob: await nenTep(f) }); doi([...teps, ...m]) }
          catch (er) { thongBao((er as Error).message, 'loi') }
          setBan(false)
        }} />
      </label>
      {teps.map((t, i) => (
        <div key={i} className="mt-1 flex items-center justify-between rounded-lg hang-nen px-3 py-1 text-sm">
          <span className="truncate">{t.name} ({Math.round(t.blob.size / 1024)} KB)</span>
          <button type="button" className="h-9 w-9 text-bad" onClick={() => doi(teps.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
    </div>
  )
}

export const NutTep = ({ teps }: { teps?: TepRow[] }) => teps?.length ? (
  <span className="inline-flex flex-wrap gap-1">
    {teps.map((t, i) => <button key={t.id} type="button" onClick={() => moTep(t.duong_dan)} className="rounded-lg bg-blue-50 px-2 py-1 text-sm text-blue-800">📎 {i + 1}</button>)}
  </span>
) : null
