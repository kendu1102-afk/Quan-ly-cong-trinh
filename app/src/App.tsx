import { HashRouter, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { CTProvider, useCT } from './lib/ct'
import { layHangDoi, SU_KIEN } from './lib/hangdoi'
import { Dang, Modal, Nut, ToastHost } from './components/ui'
import CanhBaoWatcher from './components/CanhBao'
import ThongBaoDay from './components/ThongBaoDay'
import Login from './pages/Login'
import TongQuan from './pages/TongQuan'
import DanhSachCT from './pages/DanhSachCT'
import TrangCT from './pages/TrangCT'
import BaoCaoNam from './pages/BaoCaoNam'
import TaiKhoan from './pages/TaiKhoan'
import DanhMucVT from './pages/DanhMucVT'

function TrangThaiMang() {
  const [on, setOn] = useState(navigator.onLine); const [cho, setCho] = useState(0)
  useEffect(() => {
    const f = () => setOn(navigator.onLine); const g = () => layHangDoi().then((a) => setCho(a.length))
    window.addEventListener('online', f); window.addEventListener('offline', f); window.addEventListener(SU_KIEN, g); g()
    return () => { window.removeEventListener('online', f); window.removeEventListener('offline', f); window.removeEventListener(SU_KIEN, g) }
  }, [])
  if (on && !cho) return null
  return (
    <div className={`px-3 py-1.5 text-center text-sm font-semibold text-white ${on ? 'bg-brand-2' : 'bg-warn'}`}>
      {!on ? '⚠ Mất mạng — vẫn nhập được, dữ liệu sẽ tự gửi khi có Internet' : ''}{cho ? ` ${on ? '⏳' : '·'} ${cho} bản ghi đang chờ gửi` : ''}
    </div>
  )
}

function Khung() {
  const { ho, isAdmin, thoat } = useAuth()
  const { cur } = useCT()
  const nav = useNavigate()
  const [them, setThem] = useState(false)
  const [dayTB, setDayTB] = useState(false)
  const ct = cur ? `/ct/${cur}` : '/ct'
  const item = (to: string, bieu: string, ten: string) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `flex flex-1 flex-col items-center justify-center py-1.5 text-xs font-semibold ${isActive ? 'active' : ''}`}>
      <span className="text-2xl leading-none">{bieu}</span>{ten}
    </NavLink>
  )
  return (
    <div className="mx-auto min-h-screen max-w-5xl pb-24">
      <TrangThaiMang />
      <header className="dau-trang sticky top-0 z-30 px-3 py-2">
        <div className="flex items-center gap-2">
          <NavLink to="/" aria-label="Trang chủ" className="logo-huy shrink-0"><img src="/logo.webp" alt="Logo" className="h-11 w-auto" /></NavLink>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[11px] font-semibold tracking-[.12em] text-gold-2 sm:text-sm">CÔNG TY TNHH XÂY DỰNG</div>
            <div className="truncate text-xl font-extrabold tracking-[.14em] text-white drop-shadow sm:text-2xl">TRƯỜNG LỘ</div>
            <div className="hidden truncate text-xs italic text-white/75 sm:block">Kiến tạo hạ tầng - Vững bước tương lai</div>
          </div>
          <button onClick={() => setThem(true)} className="tk-nut min-h-11 max-w-[8.5rem] shrink-0 truncate rounded-xl px-3 text-sm font-semibold">{ho?.ho_ten || 'Tài khoản'} ▾</button>
        </div>
      </header>
      <main className="p-3">
        <Routes>
          <Route path="/" element={<TongQuan />} />
          <Route path="/ct" element={<DanhSachCT />} />
          <Route path="/ct/:id" element={<Navigate to="thong-tin" replace />} />
          <Route path="/ct/:id/:tab" element={<TrangCT />} />
          <Route path="/bao-cao" element={isAdmin ? <BaoCaoNam /> : <Navigate to="/" />} />
          <Route path="/vat-tu-mau" element={isAdmin ? <DanhMucVT /> : <Navigate to="/" />} />
          <Route path="/tai-khoan" element={isAdmin ? <TaiKhoan /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <nav className="thanh-duoi fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-5xl">
          {item('/', '🏠', 'Tổng quan')}{item('/ct', '🏗️', 'Công trình')}
          {item(`${ct}/nhap-vt`, '🧱', 'Nhập VT')}{item(`${ct}/chi-phi`, '💵', 'Chi phí')}
          <button onClick={() => setThem(true)} className="flex flex-1 flex-col items-center justify-center py-1.5 text-xs font-semibold"><span className="text-2xl leading-none">☰</span>Thêm</button>
        </div>
      </nav>
      {them && (
        <Modal tieuDe="Menu" dong={() => setThem(false)}>
          <div className="space-y-2" onClick={() => setThem(false)}>
            <Nut mau="phu" className="w-full" onClick={() => nav(`${ct}/th-vt`)}>📊 Tổng hợp vật tư</Nut>
            <Nut mau="phu" className="w-full" onClick={() => nav(`${ct}/th-cp`)}>📈 Tổng hợp chi phí</Nut>
            <Nut mau="phu" className="w-full" onClick={() => nav(`${ct}/tai-chinh`)}>💰 Tài chính công trình</Nut>
            {isAdmin && <Nut mau="phu" className="w-full" onClick={() => nav('/vat-tu-mau')}>🧰 Nhập vật tư mẫu (dùng chung)</Nut>}
            {isAdmin && <Nut mau="phu" className="w-full" onClick={() => nav('/bao-cao')}>🗓️ Báo cáo theo năm</Nut>}
            {isAdmin && <Nut mau="phu" className="w-full" onClick={() => nav('/tai-khoan')}>👥 Quản lý tài khoản</Nut>}
            <Nut mau="xam" className="w-full" onClick={() => setDayTB(true)}>🔔 Thông báo đẩy cảnh báo vật tư</Nut>
            <Nut mau="do" className="w-full" onClick={() => { if (confirm('Đăng xuất?')) thoat() }}>Đăng xuất ({ho?.vai_tro === 'admin' ? 'Admin' : 'Kế toán'})</Nut>
          </div>
        </Modal>
      )}
      {dayTB && <ThongBaoDay dong={() => setDayTB(false)} />}
      <CanhBaoWatcher />
    </div>
  )
}

function Cong() {
  const { session, ho, dangTai } = useAuth()
  if (dangTai) return <Dang />
  if (!session) return <Login />
  if (!ho) return <Dang t="Đang tải hồ sơ… (cần Internet lần đầu)" />
  return <CTProvider><Khung /></CTProvider>
}
export default function App() {
  return <AuthProvider><HashRouter><Cong /></HashRouter><ToastHost /></AuthProvider>
}
