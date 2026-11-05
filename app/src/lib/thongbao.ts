type Loai = 'ok' | 'loi' | 'canhbao'
export const thongBao = (noiDung: string, loai: Loai = 'ok') =>
  window.dispatchEvent(new CustomEvent('toast', { detail: { noiDung, loai, id: Math.random() } }))

/** Thông báo của hệ điều hành (khi ứng dụng đang mở hoặc chạy nền). Chưa phải push khi ứng dụng đã đóng hẳn. */
export async function thongBaoHeThong(tieuDe: string, noiDung: string) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(tieuDe, { body: noiDung, icon: '/icon-192.png', tag: tieuDe })
    else new Notification(tieuDe, { body: noiDung })
  } catch { /* bỏ qua */ }
}
