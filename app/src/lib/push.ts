import { supabase } from './supabase'
import { goiHam } from './ham'

export type TrangThaiPush = 'khong-ho-tro' | 'can-cai-ung-dung' | 'bi-chan' | 'chua-bat' | 'da-bat'

const base64ToUint8 = (s: string) => {
  const b = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}
const laIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const daCai = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

export async function trangThaiPush(): Promise<TrangThaiPush> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return laIOS() && !daCai() ? 'can-cai-ung-dung' : 'khong-ho-tro'
  if (Notification.permission === 'denied') return 'bi-chan'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub && Notification.permission === 'granted') return 'da-bat'
  } catch { /* coi như chưa bật */ }
  return 'chua-bat'
}

export async function batPush() {
  if (Notification.permission !== 'granted') {
    const r = await Notification.requestPermission()
    if (r !== 'granted') throw new Error('Bạn chưa cho phép thông báo. Hãy cho phép thông báo cho trang này trong cài đặt trình duyệt.')
  }
  const reg = await navigator.serviceWorker.ready
  const { khoa_cong_khai } = await goiHam<{ khoa_cong_khai: string }>({ hanh_dong: 'khoa_vapid' })
  const khoa = base64ToUint8(khoa_cong_khai)
  let sub = await reg.pushManager.getSubscription()
  if (sub) {   // đăng ký cũ dùng khóa khác thì hủy để đăng ký lại
    const cu = sub.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null
    if (!cu || cu.length !== khoa.length || cu.some((v, i) => v !== khoa[i])) { await sub.unsubscribe(); sub = null }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: khoa })
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await supabase.rpc('dang_ky_thiet_bi', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ten_may: navigator.userAgent })
  if (error) throw new Error(error.message)
}

export async function tatPush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.rpc('huy_dang_ky_thiet_bi', { p_endpoint: sub.endpoint })
  await sub.unsubscribe()
}

export const guiThuPush = () => goiHam<{ thiet_bi: number; da_gui: number; loi: number }>({ hanh_dong: 'gui_thu' })
