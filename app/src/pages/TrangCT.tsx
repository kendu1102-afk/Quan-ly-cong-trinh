import { NavLink, useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { useCT } from '../lib/ct'
import { useAuth } from '../lib/auth'
import { fmtNgay, fmtTien, TRANG_THAI } from '../lib/tinh'
import { hanHopDong } from '../lib/han'
import { Dang, Huy, Nut, Rong, The, TieuDe } from '../components/ui'
import ChonCongTrinh from '../components/ChonCongTrinh'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { FormCT } from './DanhSachCT'
import NhapVT from './ct/NhapVT'
import ChiPhi from './ct/ChiPhi'
import VatTuMau from './ct/VatTuMau'
import THVT from './ct/THVT'
import THCP from './ct/THCP'
import TaiChinh from './ct/TaiChinh'

const TABS = [['thong-tin', 'Thông tin'], ['vat-tu-mau', 'Vật tư theo dự toán'], ['nhap-vt', 'Nhập vật tư'], ['chi-phi', 'Chi phí'], ['th-vt', 'TH vật tư'], ['th-cp', 'TH chi phí'], ['tai-chinh', 'Tài chính']] as const

export default function TrangCT() {
  const { id, tab } = useParams()
  const { ds, dangTai, chon } = useCT()
  const { isAdmin } = useAuth()
  const nav = useNavigate()
  const [doi, setDoi] = useState(false)
  const ct = ds.find((c) => c.id === id)
  useEffect(() => { if (id && ct) chon(id) }, [id, ct?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (dangTai) return <Dang />
  if (!ct) return <Rong t="Không tìm thấy công trình hoặc bạn chưa được cấp quyền." />
  return (
    <div className="space-y-3">
      <div className="the the-vang flex items-center gap-3 !py-2">
        <div className="min-w-0 flex-1"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Công trình</div><div className="line-clamp-3 font-extrabold leading-snug text-brand">{ct.ten}</div></div>
        <Nut mau="phu" className="min-h-10 shrink-0 px-3 text-sm" onClick={() => setDoi(true)}>🔄 Đổi công trình</Nut>
      </div>
      <div className="-mx-3 overflow-x-auto px-3"><div className="flex w-max gap-2">
        {TABS.map(([k, t]) => <NavLink key={k} to={`/ct/${ct.id}/${k}`} className={({ isActive }) => `tab-ct ${isActive ? 'active' : ''}`}>{t}</NavLink>)}
      </div></div>
      {ct.luu_tru && <div className="rounded-xl bg-slate-200 p-2 text-center text-sm">📦 Công trình đã lưu trữ (chỉ để tra cứu)</div>}
      {doi && <ChonCongTrinh tieuDe="Chuyển sang công trình khác" dong={() => setDoi(false)} chon={(nid) => { chon(nid); setDoi(false); nav(`/ct/${nid}/${tab ?? 'thong-tin'}`) }} />}
      {tab === 'thong-tin' && <ThongTin ct={ct} sua={isAdmin} />}
      {tab === 'vat-tu-mau' && <VatTuMau ct={ct.id} />}
      {tab === 'nhap-vt' && <NhapVT ct={ct.id} />}
      {tab === 'chi-phi' && <ChiPhi ct={ct.id} />}
      {tab === 'th-vt' && <THVT ct={ct.id} />}
      {tab === 'th-cp' && <THCP ct={ct.id} />}
      {tab === 'tai-chinh' && <TaiChinh ct={ct.id} />}
    </div>
  )
}

function ThongTin({ ct, sua }: { ct: NonNullable<ReturnType<typeof useCT>['hienTai']>; sua: boolean }) {
  const { tai } = useCT(); const [mo, setMo] = useState(false)
  const conHan = hanHopDong(ct)
  const dong = (a: string, b: string) => <div className="flex justify-between gap-3 border-b py-2"><span className="text-slate-500">{a}</span><b className="text-right">{b || '—'}</b></div>
  return (
    <div>
      <TieuDe phai={sua && <Nut onClick={() => setMo(true)}>✏️ Sửa</Nut>}>{ct.ten}</TieuDe>
      <The>
        <div className="mb-2"><Huy loai={ct.trang_thai === 'hoan_thanh' ? 'ok' : ct.trang_thai === 'tam_dung' ? 'xam' : 'xanh'}>{TRANG_THAI[ct.trang_thai]}</Huy></div>
        {dong('Chủ đầu tư', ct.chu_dau_tu)}{dong('Địa điểm', ct.dia_diem)}
        {dong('Số hợp đồng', ct.so_hop_dong ?? '')}{dong('Ngày ký hợp đồng', fmtNgay(ct.ngay_ky_hop_dong))}
        {dong('Giá trị hợp đồng', fmtTien(ct.gia_tri_hop_dong) + ' đ')}{dong('Tiến độ thực hiện theo hợp đồng', ct.tien_do ?? '')}
        {dong('Ngày khởi công', fmtNgay(ct.ngay_khoi_cong))}{dong('Ngày hoàn thành theo hợp đồng', fmtNgay(ct.ngay_hoan_thanh_dk))}
        {conHan && <div className="flex justify-between gap-3 border-b py-2"><span className="text-slate-500">Thời hạn hợp đồng</span><Huy loai={conHan.loai}>{conHan.chu}</Huy></div>}
        {dong('Ngày ký biên bản bàn giao đưa vào sử dụng', fmtNgay(ct.ngay_ky_bb_ban_giao))}
        {dong('Năm thực hiện', String(ct.nam))}{dong('Ghi chú', ct.ghi_chu)}
      </The>
      {mo && <FormCT ct={ct} dong={() => setMo(false)} xong={() => { setMo(false); tai() }} />}
    </div>
  )
}
