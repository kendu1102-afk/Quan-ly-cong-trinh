// Kiểm thử service worker THẬT trong Chromium: giả lập máy chủ đẩy gửi một gói tin push tới service worker
// (qua giao thức DevTools) và kiểm tra thông báo hiển thị đúng nội dung, đúng đường dẫn khi bấm vào.
const { chromium, devices } = require('playwright')
const URL = 'http://localhost:54321/'
let ok = 0, bad = 0
const kt = (c, n, e = '') => { c ? (ok++, console.log('  OK  ', n)) : (bad++, console.log('  LỖI ', n, e)) }
;(async () => {
  const dir = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'sw-')); const ctx = await chromium.launchPersistentContext(dir, { ...devices['Pixel 7'], serviceWorkers: 'allow', channel: 'chromium' }); const b = { close: () => ctx.close() }
  await ctx.grantPermissions(['notifications'], { origin: 'http://localhost:54321' })
  const p = await ctx.newPage(); const quyen = () => p.evaluate(() => Notification.permission); const cdp = await ctx.newCDPSession(p)
  let regId; await cdp.send('ServiceWorker.enable'); cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => { if (e.registrations[0]) regId = e.registrations[0].registrationId })
  await p.goto(URL); await p.waitForSelector('text=Đăng nhập')
  kt((await quyen()) === 'granted', 'trình duyệt thử nghiệm đã được cấp quyền thông báo', await quyen())
  const active = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active })
  kt(active, 'service worker đã được cài và kích hoạt')
  for (let i = 0; i < 30 && !regId; i++) await p.waitForTimeout(200)
  kt(!!regId, 'lấy được mã đăng ký service worker')
  await cdp.send('ServiceWorker.deliverPushMessage', { origin: 'http://localhost:54321', registrationId: regId, data: JSON.stringify({ tieu_de: 'Vật tư VƯỢT dự toán', noi_dung: 'Cầu A · Xi măng: dự toán 100 tấn, đã nhập 110 — VƯỢT 10 tấn', url: '/#/ct/abc/th-vt', tag: 'cb-1' }) })
  let ds = []; for (let i = 0; i < 25 && !ds.length; i++) { await p.waitForTimeout(200); ds = await p.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ t: n.title, b: n.body, tag: n.tag, url: n.data && n.data.url }))) }
  kt(ds.length === 1 && ds[0].t === 'Vật tư VƯỢT dự toán', 'nhận gói push khi chưa đăng nhập/đóng ứng dụng: hiện thông báo đúng tiêu đề', JSON.stringify(ds))
  kt(ds[0] && ds[0].b.includes('VƯỢT 10 tấn') && ds[0].url === '/#/ct/abc/th-vt' && ds[0].tag === 'cb-1', 'nội dung, đường dẫn và nhãn thông báo đúng')
  await cdp.send('ServiceWorker.deliverPushMessage', { origin: 'http://localhost:54321', registrationId: regId, data: JSON.stringify({ tieu_de: 'Vật tư VƯỢT dự toán', noi_dung: 'đã vượt 12', url: '/#/ct/abc/th-vt', tag: 'cb-1' }) })
  await p.waitForTimeout(800); ds = await p.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => n.body))
  kt(ds.length === 1 && ds[0] === 'đã vượt 12', 'cùng một vật tư: thông báo mới thay thế thông báo cũ, không chồng chất', JSON.stringify(ds))
  await cdp.send('ServiceWorker.deliverPushMessage', { origin: 'http://localhost:54321', registrationId: regId, data: 'văn bản thuần, không phải JSON' })
  await p.waitForTimeout(800); ds = await p.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).length)
  kt(ds === 2, 'gói tin lạ (không phải JSON) vẫn hiển thị, không làm hỏng service worker', String(ds))
  // ứng dụng vẫn mở được khi offline (nhờ lưu sẵn)
  await p.reload(); await p.waitForSelector('text=Đăng nhập'); await ctx.setOffline(true); await p.reload(); kt(await p.getByText('QUẢN LÝ CÔNG TRÌNH').isVisible({ timeout: 8000 }).catch(() => false), 'mở lại ứng dụng khi không có mạng vẫn được (đã lưu sẵn)')
  console.log(`\n===== KẾT QUẢ: ${ok} đạt, ${bad} lỗi =====`); await b.close(); process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('DỪNG:', e.message.split('\n')[0]); process.exit(2) })
