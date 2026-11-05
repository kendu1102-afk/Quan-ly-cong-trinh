import { useState } from 'react'
import { supabase, taoEmail, cauHinhDu } from '../lib/supabase'
import { Nut, Truong, o, Loi } from '../components/ui'

export default function Login() {
  const [tk, setTk] = useState(''); const [mk, setMk] = useState(''); const [loi, setLoi] = useState(''); const [bận, setBan] = useState(false)
  const vao = async (e: React.FormEvent) => {
    e.preventDefault(); setLoi(''); setBan(true)
    const { error } = await supabase.auth.signInWithPassword({ email: taoEmail(tk), password: mk })
    setBan(false)
    if (error) setLoi(error.message.includes('Invalid') ? 'Sai tên đăng nhập hoặc mật khẩu' : error.message.includes('fetch') ? 'Không có kết nối Internet' : error.message)
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand to-brand-2 p-4">
      <form onSubmit={vao} className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-xl">
        <div className="text-center"><img src="/favicon.svg" alt="" className="mx-auto h-20 w-20" />
          <h1 className="mt-2 text-2xl font-extrabold text-brand">QUẢN LÝ CÔNG TRÌNH</h1>
          <p className="text-slate-500">Đăng nhập để tiếp tục</p></div>
        {!cauHinhDu && <Loi t="Chưa cấu hình máy chủ (thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)." />}
        <Truong nhan="Tên đăng nhập hoặc email"><input className={o} value={tk} onChange={(e) => setTk(e.target.value)} autoCapitalize="none" autoComplete="username" required /></Truong>
        <Truong nhan="Mật khẩu"><input className={o} type="password" value={mk} onChange={(e) => setMk(e.target.value)} autoComplete="current-password" required /></Truong>
        <Loi t={loi} />
        <Nut type="submit" className="w-full text-lg" disabled={bận}>{bận ? 'Đang đăng nhập…' : 'Đăng nhập'}</Nut>
      </form>
    </div>
  )
}
