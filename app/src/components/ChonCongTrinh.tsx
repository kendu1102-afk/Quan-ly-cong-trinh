import { useState } from 'react'
import { useCT } from '../lib/ct'
import { fmtTien, TRANG_THAI } from '../lib/tinh'
import { Huy, Modal, Rong, o } from './ui'

/** Bảng chọn công trình (thay cho ô chọn ở đầu trang): bấm vào công trình là vào thẳng */
export default function ChonCongTrinh({ tieuDe, dong, chon }: { tieuDe: string; dong: () => void; chon: (id: string) => void }) {
  const { ds } = useCT()
  const [q, setQ] = useState('')
  const bo = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
  const dang = ds.filter((c) => !c.luu_tru)
  const loc = dang.filter((c) => bo(`${c.ten} ${c.chu_dau_tu} ${c.dia_diem}`).includes(bo(q)))
  return (
    <Modal tieuDe={tieuDe} dong={dong}>
      <div className="space-y-2">
        {dang.length > 5 && <input autoFocus className={o} placeholder="🔍 Gõ để tìm công trình…" value={q} onChange={(e) => setQ(e.target.value)} />}
        {!dang.length && <Rong t="Chưa có công trình nào đang quản lý, hoặc bạn chưa được cấp quyền." />}
        {loc.map((c) => (
          <button key={c.id} type="button" onClick={() => chon(c.id)} className="block w-full rounded-2xl border border-brand/15 bg-white p-3 text-left shadow-sm active:bg-amber-50">
            <div className="flex items-start justify-between gap-2"><b className="text-brand">{c.ten}</b><Huy loai={c.trang_thai === 'hoan_thanh' ? 'ok' : c.trang_thai === 'tam_dung' ? 'xam' : 'xanh'}>{TRANG_THAI[c.trang_thai]}</Huy></div>
            <div className="text-sm text-slate-600">{c.chu_dau_tu}{c.dia_diem ? ' · ' + c.dia_diem : ''}</div>
            <div className="text-sm num text-slate-500">Hợp đồng {fmtTien(c.gia_tri_hop_dong)} đ · Năm {c.nam}</div>
          </button>
        ))}
        {!!dang.length && !loc.length && <Rong t="Không tìm thấy" />}
      </div>
    </Modal>
  )
}
