import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useDuLieu } from '../lib/dulieu'
import { useAuth, type HoSo } from '../lib/auth'
import { useCT } from '../lib/ct'
import { fmtGio } from '../lib/tinh'
import { Dang, Huy, Loi, Modal, Nut, Rong, The, TieuDe, Truong, o } from '../components/ui'
import { thongBao } from '../lib/thongbao'
import { taiVe } from '../lib/excel'

async function goiQuanTri(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('quan-tri-tai-khoan', { body })
  if (error) {
    let m = error.message
    try { const j = await (error as unknown as { context: Response }).context.json(); if (j?.loi) m = j.loi } catch { /* giữ nguyên */ }
    throw new Error(m)
  }
  if (data?.loi) throw new Error(data.loi)
  return data
}

export default function TaiKhoan() {
  const { ho, taiLaiNguoi } = useAuth()
  const { ds } = useCT()
  const q = useDuLieu<HoSo[]>(() => supabase.from('profiles').select('*').order('created_at') as never, [], ['profiles'])
  const pq = useDuLieu<{ user_id: string; cong_trinh_id: string }[]>(() => supabase.from('phan_quyen').select('*') as never, [], ['phan_quyen'])
  const [tao, setTao] = useState(false); const [dat, setDat] = useState<HoSo | null>(null); const [quyen, setQuyen] = useState<HoSo | null>(null)
  const [nk, setNk] = useState(false)
  if (q.dangTai) return <Dang />
  const doi = async (u: HoSo, bi_khoa: boolean) => {
    if (!confirm(`${bi_khoa ? 'KHÓA' : 'Mở khóa'} tài khoản ${u.ho_ten || u.email}?`)) return
    const { error } = await supabase.from('profiles').update({ bi_khoa }).eq('id', u.id)
    error ? thongBao(error.message, 'loi') : (thongBao(bi_khoa ? 'Đã khóa' : 'Đã mở khóa'), q.tai())
  }
  return (
    <div className="space-y-4">
      <TieuDe phai={<Nut onClick={() => setTao(true)}>＋ Tạo tài khoản kế toán</Nut>}>Quản lý tài khoản</TieuDe>
      {q.data?.map((u) => (
        <The key={u.id}>
          <div className="flex items-start justify-between gap-2">
            <div><b className="text-brand">{u.ho_ten || '(chưa đặt tên)'}</b><div className="text-sm text-slate-600">{u.email?.replace(/@qlct\.example$/, '')}</div></div>
            <div className="flex gap-1"><Huy loai={u.vai_tro === 'admin' ? 'xanh' : 'xam'}>{u.vai_tro === 'admin' ? 'Admin' : 'Kế toán'}</Huy>{u.bi_khoa && <Huy loai="vuot">Đã khóa</Huy>}</div>
          </div>
          {u.vai_tro === 'ketoan' && <div className="mt-1 text-sm text-slate-600">Công trình được xem: {(pq.data ?? []).filter((p) => p.user_id === u.id).length}/{ds.length}</div>}
          <div className="mt-2 flex flex-wrap gap-2">
            {u.vai_tro === 'ketoan' && <Nut mau="phu" className="min-h-10 px-3 text-sm" onClick={() => setQuyen(u)}>Phân quyền công trình</Nut>}
            <Nut mau="xam" className="min-h-10 px-3 text-sm" onClick={() => setDat(u)}>Cấp lại mật khẩu</Nut>
            {u.id !== ho?.id && <Nut mau={u.bi_khoa ? 'chinh' : 'do'} className="min-h-10 px-3 text-sm" onClick={() => doi(u, !u.bi_khoa)}>{u.bi_khoa ? 'Mở khóa' : 'Khóa'}</Nut>}
          </div>
        </The>
      ))}
      <SaoLuu />
      <Nut mau="phu" className="w-full" onClick={() => setNk(true)}>📜 Xem nhật ký hoạt động</Nut>
      {tao && <FormTao dong={() => setTao(false)} xong={() => { setTao(false); q.tai(); taiLaiNguoi() }} />}
      {dat && <FormMK u={dat} dong={() => setDat(null)} />}
      {quyen && <FormQuyen u={quyen} hien={(pq.data ?? []).filter((p) => p.user_id === quyen.id).map((p) => p.cong_trinh_id)} dong={() => setQuyen(null)} xong={() => { pq.tai() }} />}
      {nk && <NhatKy dong={() => setNk(false)} />}
    </div>
  )
}

function FormTao({ dong, xong }: { dong: () => void; xong: () => void }) {
  const [f, setF] = useState({ ten: '', ho_ten: '', mk: '' }); const [loi, setLoi] = useState(''); const [ban, setBan] = useState(false)
  return (
    <Modal tieuDe="Tạo tài khoản kế toán" dong={dong}>
      <div className="space-y-3">
        <Truong nhan="Họ và tên"><input className={o} value={f.ho_ten} onChange={(e) => setF({ ...f, ho_ten: e.target.value })} /></Truong>
        <Truong nhan="Tên đăng nhập (không dấu, vd: ketoan1)"><input className={o} autoCapitalize="none" value={f.ten} onChange={(e) => setF({ ...f, ten: e.target.value })} /></Truong>
        <Truong nhan="Mật khẩu (tối thiểu 8 ký tự)"><input className={o} value={f.mk} onChange={(e) => setF({ ...f, mk: e.target.value })} /></Truong>
        <Loi t={loi} />
        <Nut className="w-full" disabled={ban} onClick={async () => {
          setBan(true); setLoi('')
          try { await goiQuanTri({ hanh_dong: 'tao', ten_dang_nhap: f.ten, ho_ten: f.ho_ten, mat_khau: f.mk }); thongBao('Đã tạo tài khoản. Nhớ cấp quyền công trình cho tài khoản này.'); xong() }
          catch (e) { setLoi((e as Error).message) } setBan(false)
        }}>Tạo tài khoản</Nut>
      </div>
    </Modal>
  )
}
function FormMK({ u, dong }: { u: HoSo; dong: () => void }) {
  const [mk, setMk] = useState(''); const [loi, setLoi] = useState('')
  return (
    <Modal tieuDe={`Cấp lại mật khẩu: ${u.ho_ten || u.email}`} dong={dong}>
      <div className="space-y-3"><Truong nhan="Mật khẩu mới (tối thiểu 8 ký tự)"><input className={o} value={mk} onChange={(e) => setMk(e.target.value)} /></Truong><Loi t={loi} />
        <Nut className="w-full" onClick={async () => { try { await goiQuanTri({ hanh_dong: 'doi_mat_khau', user_id: u.id, mat_khau: mk }); thongBao('Đã đổi mật khẩu'); dong() } catch (e) { setLoi((e as Error).message) } }}>Đổi mật khẩu</Nut></div>
    </Modal>
  )
}
function FormQuyen({ u, hien, dong, xong }: { u: HoSo; hien: string[]; dong: () => void; xong: () => void }) {
  const { ds } = useCT(); const [chon, setChon] = useState(new Set(hien)); const [ban, setBan] = useState(false)
  const luu = async () => {
    setBan(true)
    const them = [...chon].filter((x) => !hien.includes(x)).map((cong_trinh_id) => ({ user_id: u.id, cong_trinh_id }))
    const bo = hien.filter((x) => !chon.has(x))
    let e1 = null, e2 = null
    if (them.length) e1 = (await supabase.from('phan_quyen').insert(them)).error
    if (bo.length) e2 = (await supabase.from('phan_quyen').delete().eq('user_id', u.id).in('cong_trinh_id', bo)).error
    setBan(false)
    if (e1 || e2) return thongBao((e1 ?? e2)!.message, 'loi')
    thongBao('Đã cập nhật phân quyền'); xong(); dong()
  }
  return (
    <Modal tieuDe={`Công trình cho ${u.ho_ten || u.email}`} dong={dong}>
      <div className="space-y-2">
        {!ds.length && <Rong t="Chưa có công trình" />}
        {ds.map((c) => <label key={c.id} className="flex min-h-12 items-center gap-3 rounded-xl bg-slate-50 px-3"><input type="checkbox" className="h-6 w-6" checked={chon.has(c.id)} onChange={() => setChon((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n })} /><span>{c.ten} <span className="text-slate-500">({c.nam})</span></span></label>)}
        <Nut className="w-full" disabled={ban} onClick={luu}>Lưu phân quyền</Nut>
      </div>
    </Modal>
  )
}

function SaoLuu() {
  const [ban, setBan] = useState(false)
  const sao = async (ghiChu = '') => {
    const { data, error } = await supabase.rpc('xuat_sao_luu')
    if (error) throw error
    const d = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
    taiVe(new Blob([JSON.stringify(data)], { type: 'application/json' }), `sao-luu-qlct-${ghiChu}${d}.json`)
    return data
  }
  return (
    <The className="space-y-2">
      <h3 className="font-bold text-brand">Sao lưu và phục hồi dữ liệu</h3>
      <p className="text-sm text-slate-600">Sao lưu gồm toàn bộ công trình, vật tư, chi phí, phân quyền (không gồm file ảnh hóa đơn và mật khẩu). Nên tải về và cất ở nơi an toàn mỗi tuần.</p>
      <Nut className="w-full" disabled={ban} onClick={async () => { setBan(true); try { await sao(); thongBao('Đã tạo tệp sao lưu') } catch (e) { thongBao((e as Error).message, 'loi') } setBan(false) }}>💾 Sao lưu ngay (tải tệp về máy)</Nut>
      <label className="block">
        <span className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-bad px-4 font-semibold text-bad">♻️ Phục hồi từ tệp sao lưu</span>
        <input type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
          try {
            const j = JSON.parse(await f.text())
            if (!confirm(`Phục hồi từ tệp “${f.name}”?\n\nHệ thống sẽ TỰ ĐỘNG tải về bản sao lưu dữ liệu hiện tại trước, sau đó bổ sung/ghi đè dữ liệu theo tệp. Dữ liệu hiện có không nằm trong tệp sẽ được giữ nguyên.`)) return
            setBan(true); await sao('truoc-khi-phuc-hoi-')
            const { data, error } = await supabase.rpc('phuc_hoi_sao_luu', { data: j })
            if (error) throw error
            thongBao('Đã phục hồi: ' + JSON.stringify(data))
          } catch (er) { thongBao('Phục hồi lỗi: ' + (er as Error).message, 'loi') }
          setBan(false)
        }} />
      </label>
    </The>
  )
}

type NK = { id: number; thoi_gian: string; user_id: string | null; hanh_dong: string; bang: string; ban_ghi_id: string | null; truoc: unknown; sau: unknown }
function NhatKy({ dong }: { dong: () => void }) {
  const { nguoi } = useAuth()
  const [bang, setBang] = useState('')
  const q = useDuLieu<NK[]>(() => { let b = supabase.from('nhat_ky').select('*').order('id', { ascending: false }).limit(200); if (bang) b = b.eq('bang', bang); return b as never }, [bang], ['nhat_ky'])
  const TEN: Record<string, string> = { THEM: 'Thêm', SUA: 'Sửa', XOA: 'Xóa', KHOI_PHUC: 'Khôi phục', XOA_VINH_VIEN: 'Xóa vĩnh viễn' }
  return (
    <Modal tieuDe="Nhật ký hoạt động (200 gần nhất)" dong={dong}>
      <select className={`${o} mb-3`} value={bang} onChange={(e) => setBang(e.target.value)}><option value="">Tất cả</option>{['cong_trinh', 'vat_tu_mau', 'phieu_nhap_vt', 'chi_phi', 'phan_quyen', 'profiles', 'tep_dinh_kem'].map((b) => <option key={b}>{b}</option>)}</select>
      {q.dangTai ? <Dang /> : <div className="space-y-1">{q.data?.map((n) => {
        const s = (n.sau ?? n.truoc) as Record<string, unknown> | null
        return <div key={n.id} className="rounded-lg bg-slate-50 p-2 text-sm"><b>{TEN[n.hanh_dong]}</b> · {n.bang} · {nguoi[n.user_id ?? ''] ?? 'hệ thống'} · <span className="text-slate-500">{fmtGio(n.thoi_gian)}</span>
          {s && <div className="truncate text-slate-600">{String(s.ten ?? s.ten_chi_phi ?? s.ghi_chu ?? s.so_tien ?? s.khoi_luong ?? '')}</div>}</div>
      })}</div>}
    </Modal>
  )
}
