import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCT, type CongTrinh } from '../lib/ct'
import { fmtNgay, fmtTien, TRANG_THAI, docSo } from '../lib/tinh'
import { Huy, Modal, Nut, Rong, The, TieuDe, Truong, o, Loi } from '../components/ui'
import { thongBao } from '../lib/thongbao'

const trong = { ten: '', chu_dau_tu: '', dia_diem: '', so_hop_dong: '', ngay_ky_hop_dong: '', gia_tri_hop_dong: '', tien_do: '', ngay_khoi_cong: '', ngay_hoan_thanh_dk: '', ngay_ky_bb_ban_giao: '', nam: String(new Date().getFullYear()), ghi_chu: '', trang_thai: 'dang_thuc_hien' }

export function FormCT({ ct, xong, dong }: { ct?: CongTrinh; xong: () => void; dong: () => void }) {
  const [f, setF] = useState(ct ? { ...trong, ...Object.fromEntries(Object.entries(ct).map(([k, v]) => [k, v == null ? '' : String(v)])) } : trong)
  const [loi, setLoi] = useState(''); const [ban, setBan] = useState(false)
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }))
  const luu = async (e: React.FormEvent) => {
    e.preventDefault(); setLoi('')
    const gt = f.gia_tri_hop_dong === '' ? 0 : docSo(String(f.gia_tri_hop_dong))
    if (!f.ten.trim()) return setLoi('Nhập tên công trình')
    if (!Number.isFinite(gt) || gt < 0) return setLoi('Giá trị hợp đồng không hợp lệ')
    if (f.ngay_khoi_cong && f.ngay_hoan_thanh_dk && f.ngay_hoan_thanh_dk < f.ngay_khoi_cong) return setLoi('Ngày hoàn thành theo hợp đồng không được trước ngày khởi công')
    const goc = { ten: f.ten.trim(), chu_dau_tu: f.chu_dau_tu, dia_diem: f.dia_diem, gia_tri_hop_dong: gt, ngay_khoi_cong: f.ngay_khoi_cong || null,
      ngay_hoan_thanh_dk: f.ngay_hoan_thanh_dk || null, nam: Number(f.nam) || new Date().getFullYear(), ghi_chu: f.ghi_chu, trang_thai: f.trang_thai }
    const moi = { so_hop_dong: f.so_hop_dong.trim(), ngay_ky_hop_dong: f.ngay_ky_hop_dong || null, tien_do: f.tien_do.trim(), ngay_ky_bb_ban_giao: f.ngay_ky_bb_ban_giao || null }
    const gui = (row: Record<string, unknown>) => ct ? supabase.from('cong_trinh').update(row, { count: 'exact' }).eq('id', ct.id).eq('version', ct.version) : supabase.from('cong_trinh').insert(row)
    setBan(true)
    let r = await gui({ ...goc, ...moi })
    // Phòng khi chưa chạy tệp SQL 05 trên Supabase: vẫn lưu được phần thông tin cũ và báo rõ
    if (r.error && /so_hop_dong|ngay_ky_hop_dong|tien_do|ngay_ky_bb_ban_giao/.test(r.error.message)) {
      r = await gui(goc); if (!r.error) thongBao('Đã lưu phần thông tin cũ. Các ô hợp đồng mới CHƯA lưu được vì chưa chạy tệp SQL 05 trên Supabase.', 'canhbao')
    }
    setBan(false)
    if (r.error) return setLoi(r.error.message)
    if (ct && r.count === 0) return setLoi('Dữ liệu đã được người khác sửa trước. Hãy đóng và mở lại để lấy bản mới nhất.')
    if (!r.error) thongBao('Đã lưu công trình'); xong()
  }
  return (
    <Modal tieuDe={ct ? 'Sửa công trình' : 'Thêm công trình'} dong={dong}>
      <form onSubmit={luu} className="space-y-3">
        <Truong nhan="Tên công trình *"><input className={o} value={f.ten} onChange={(e) => set('ten', e.target.value)} /></Truong>
        <Truong nhan="Chủ đầu tư"><input className={o} value={f.chu_dau_tu} onChange={(e) => set('chu_dau_tu', e.target.value)} /></Truong>
        <Truong nhan="Địa điểm xây dựng"><input className={o} value={f.dia_diem} onChange={(e) => set('dia_diem', e.target.value)} /></Truong>
        <div className="grid grid-cols-2 gap-3">
          <Truong nhan="Số hợp đồng"><input className={o} value={f.so_hop_dong} onChange={(e) => set('so_hop_dong', e.target.value)} placeholder="vd: 12/2026/HĐ-XD" /></Truong>
          <Truong nhan="Ngày ký hợp đồng"><input type="date" className={o} value={f.ngay_ky_hop_dong} onChange={(e) => set('ngay_ky_hop_dong', e.target.value)} /></Truong>
        </div>
        <Truong nhan="Giá trị hợp đồng (đồng)"><input className={o} inputMode="decimal" value={f.gia_tri_hop_dong} onChange={(e) => set('gia_tri_hop_dong', e.target.value)} /></Truong>
        <Truong nhan="Tiến độ thực hiện theo hợp đồng"><input className={o} value={f.tien_do} onChange={(e) => set('tien_do', e.target.value)} placeholder="vd: 365 ngày, hoặc 12 tháng" /></Truong>
        <div className="grid grid-cols-2 gap-3">
          <Truong nhan="Ngày khởi công"><input type="date" className={o} value={f.ngay_khoi_cong} onChange={(e) => set('ngay_khoi_cong', e.target.value)} /></Truong>
          <Truong nhan="Ngày hoàn thành theo hợp đồng"><input type="date" className={o} value={f.ngay_hoan_thanh_dk} onChange={(e) => set('ngay_hoan_thanh_dk', e.target.value)} /></Truong>
        </div>
        <Truong nhan="Ngày ký biên bản bàn giao đưa vào sử dụng"><input type="date" className={o} value={f.ngay_ky_bb_ban_giao} onChange={(e) => set('ngay_ky_bb_ban_giao', e.target.value)} /></Truong>
        <div className="grid grid-cols-2 gap-3">
          <Truong nhan="Năm thực hiện"><input className={o} inputMode="numeric" value={f.nam} onChange={(e) => set('nam', e.target.value)} /></Truong>
          <Truong nhan="Tình trạng"><select className={o} value={f.trang_thai} onChange={(e) => set('trang_thai', e.target.value)}>{Object.entries(TRANG_THAI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Truong>
        </div>
        <Truong nhan="Ghi chú"><textarea className={o} rows={2} value={f.ghi_chu} onChange={(e) => set('ghi_chu', e.target.value)} /></Truong>
        <Loi t={loi} />
        <Nut type="submit" className="w-full" disabled={ban}>{ban ? 'Đang lưu…' : 'Lưu'}</Nut>
      </form>
    </Modal>
  )
}

export default function DanhSachCT() {
  const { isAdmin } = useAuth()
  const { ds, chon, tai } = useCT()
  const nav = useNavigate()
  const [q, setQ] = useState(''); const [luuTru, setLT] = useState(false); const [them, setThem] = useState(false)
  const bo = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
  const loc = ds.filter((c) => c.luu_tru === luuTru && bo(`${c.ten} ${c.chu_dau_tu} ${c.dia_diem}`).includes(bo(q)))
  return (
    <div className="space-y-3">
      <TieuDe phai={isAdmin && <Nut onClick={() => setThem(true)}>＋ Thêm</Nut>}>Danh sách công trình</TieuDe>
      <input className={o} placeholder="🔍 Tìm theo tên, chủ đầu tư, địa điểm…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex gap-2">
        <Nut mau={!luuTru ? 'chinh' : 'phu'} className="flex-1" onClick={() => setLT(false)}>Đang quản lý</Nut>
        <Nut mau={luuTru ? 'chinh' : 'phu'} className="flex-1" onClick={() => setLT(true)}>📦 Đã lưu trữ</Nut>
      </div>
      {!loc.length && <Rong t={isAdmin ? 'Chưa có công trình. Bấm “＋ Thêm” để tạo.' : 'Bạn chưa được cấp quyền công trình nào. Liên hệ Admin.'} />}
      {loc.map((c) => (
        <The key={c.id}>
          <button className="w-full text-left" onClick={() => { chon(c.id); nav(`/ct/${c.id}/thong-tin`) }}>
            <div className="flex items-start justify-between gap-2"><b className="text-lg text-brand">{c.ten}</b>
              <Huy loai={c.trang_thai === 'hoan_thanh' ? 'ok' : c.trang_thai === 'tam_dung' ? 'xam' : 'xanh'}>{TRANG_THAI[c.trang_thai]}</Huy></div>
            <div className="text-slate-600">{c.chu_dau_tu}{c.dia_diem ? ' · ' + c.dia_diem : ''}</div>
            <div className="mt-1 text-sm num">{c.so_hop_dong ? `HĐ số ${c.so_hop_dong} · ` : ''}Hợp đồng: <b>{fmtTien(c.gia_tri_hop_dong)}</b> · Năm {c.nam}{c.ngay_khoi_cong ? ` · ${fmtNgay(c.ngay_khoi_cong)} → ${fmtNgay(c.ngay_hoan_thanh_dk)}` : ''}</div>
          </button>
          {isAdmin && (
            <div className="mt-2 flex gap-2">
              <Nut mau="xam" className="flex-1" onClick={async () => {
                const { error } = await supabase.from('cong_trinh').update({ luu_tru: !c.luu_tru }).eq('id', c.id)
                error ? thongBao(error.message, 'loi') : (thongBao(c.luu_tru ? 'Đã bỏ lưu trữ' : 'Đã lưu trữ công trình'), tai())
              }}>{c.luu_tru ? 'Bỏ lưu trữ' : '📦 Lưu trữ'}</Nut>
              <Nut mau="do" onClick={async () => {
                const t = prompt(`XÓA VĨNH VIỄN công trình và TOÀN BỘ vật tư, chi phí của nó.\nBạn nên Sao lưu trước (Quản lý tài khoản > Sao lưu).\nGõ đúng tên công trình để xác nhận:\n${c.ten}`)
                if (t !== c.ten) return t !== null && thongBao('Tên không khớp, chưa xóa', 'loi')
                const { error } = await supabase.from('cong_trinh').delete().eq('id', c.id)
                error ? thongBao(error.message, 'loi') : (thongBao('Đã xóa công trình'), tai())
              }}>Xóa</Nut>
            </div>
          )}
        </The>
      ))}
      {them && <FormCT xong={() => { setThem(false); tai() }} dong={() => setThem(false)} />}
    </div>
  )
}
