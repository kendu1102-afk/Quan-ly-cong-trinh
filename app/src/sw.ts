/// <reference lib="webworker" />
// Service worker: lưu sẵn ứng dụng để mở nhanh/offline + nhận thông báo đẩy khi ứng dụng đã đóng.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<string | { url: string; revision: string | null }> }

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))
self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()) })

type Goi = { tieu_de?: string; noi_dung?: string; url?: string; tag?: string }

// Báo cho các cửa sổ đang mở (nếu có) biết kết quả hiển thị thông báo; dùng để kiểm thử và chẩn đoán
const baoCaoChoTrang = async (ketQua: string) => {
  for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage({ loai: 'push-ket-qua', ketQua })
}

self.addEventListener('push', (event) => {
  let d: Goi = {}
  try { d = event.data ? (event.data.json() as Goi) : {} } catch { d = { noi_dung: event.data?.text() } }
  event.waitUntil(
    self.registration.showNotification(d.tieu_de || 'Quản Lý Công Trình', {
      body: d.noi_dung || '',
      icon: '/icon-192.png',
      badge: '/favicon.png',
      tag: d.tag,                    // cùng tag thì thay thế thông báo cũ, không chồng chất
      data: { url: d.url || '/#/' },
    }).then(() => baoCaoChoTrang('da-hien'), (e) => baoCaoChoTrang('loi: ' + (e as Error).message)),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data?.url as string) || '/#/', self.location.origin).href
  event.waitUntil((async () => {
    const ds = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of ds) { if (c.url.startsWith(self.location.origin)) { await c.focus(); if ('navigate' in c) await (c as WindowClient).navigate(url); return } }
    await self.clients.openWindow(url)
  })())
})
