// Kiểm thử mã THẬT của supabase/functions/quan-tri-tai-khoan/index.ts bằng Node:
// thư viện web-push thật mã hóa/ký thông báo gửi tới một máy chủ đẩy HTTPS giả cục bộ.
import fs from 'node:fs'; import path from 'node:path'; import https from 'node:https'; import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url'
const D = path.dirname(fileURLToPath(import.meta.url)); const TMP = path.join(D, '.tmp'); fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP)
let ok = 0, bad = 0
const kt = (c, n, e = '') => { c ? (ok++, console.log('  OK  ', n)) : (bad++, console.log('  LỖI ', n, e)) }

// 1. Dựng bản chạy được trên Node từ chính mã Deno
let src = fs.readFileSync(path.join(D, '../../supabase/functions/quan-tri-tai-khoan/index.ts'), 'utf8')
src = src.replace(/import \{ createClient \} from "https:\/\/esm\.sh[^"]*";/, 'import { createClient } from "../fake-supabase.mjs";').replace('import webpush from "npm:web-push@3.6.7";', 'import webpush from "web-push";')
fs.writeFileSync(path.join(TMP, 'ham.ts'), src)
let handler; globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: 'http://x', SUPABASE_SERVICE_ROLE_KEY: 'k' })[k] }, serve: (h) => { handler = h } }
const { db, nguoiDung, goiTaoUser } = await import('./fake-supabase.mjs')
await import(pathToFileURL(path.join(TMP, 'ham.ts')).href)
const goi = async (body, { token, ma } = {}) => {
  const h = { 'content-type': 'application/json' }; if (token) h.authorization = 'Bearer ' + token; if (ma) h['x-ma-day'] = ma
  const r = await handler(new Request('http://f/', { method: 'POST', headers: h, body: JSON.stringify(body) })); return { s: r.status, j: await r.json() }
}

// 2. Máy chủ đẩy giả (HTTPS tự ký)
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(TMP, 'k.pem'), '-out', path.join(TMP, 'c.pem'), '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const nhan = []
const may = https.createServer({ key: fs.readFileSync(path.join(TMP, 'k.pem')), cert: fs.readFileSync(path.join(TMP, 'c.pem')) }, (req, res) => {
  const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => { nhan.push({ url: req.url, h: req.headers, n: Buffer.concat(c).length }); res.statusCode = req.url.startsWith('/ok') ? 201 : req.url.startsWith('/gone') ? 410 : 500; res.end() })
}); await new Promise((r) => may.listen(0, r)); const P = may.address().port
const sub = (user, duong) => { const e = crypto.createECDH('prime256v1'); e.generateKeys(); return { id: 'tb-' + Math.random(), user_id: user, endpoint: `https://localhost:${P}${duong}`, p256dh: e.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } }

// 3. Dữ liệu giả
db.profiles = [{ id: 'ad', vai_tro: 'admin', bi_khoa: false }, { id: 'kt1', vai_tro: 'ketoan', bi_khoa: false }, { id: 'kt2', vai_tro: 'ketoan', bi_khoa: false }, { id: 'kt3', vai_tro: 'ketoan', bi_khoa: true }]
db.phan_quyen = [{ user_id: 'kt1', cong_trinh_id: 'ct1' }, { user_id: 'kt3', cong_trinh_id: 'ct1' }, { user_id: 'kt2', cong_trinh_id: 'ct2' }]
db.cau_hinh_bi_mat = [{ khoa: 'ma_day_thong_bao', gia_tri: 'MA-DUNG' }]
db.thong_bao_day = [{ id: 7, cong_trinh_id: 'ct1', vat_tu_id: 'vt1', tieu_de: 'Vật tư VƯỢT dự toán', noi_dung: 'Cầu A · Xi măng: vượt 10', da_gui: false }]
db.thiet_bi_nhan_tin = [sub('ad', '/ok-ad'), sub('kt1', '/ok-kt1'), sub('kt2', '/ok-kt2'), sub('kt3', '/ok-kt3')]
Object.assign(nguoiDung, { 'tok-ad': { id: 'ad' }, 'tok-kt1': { id: 'kt1' }, 'tok-kt3': { id: 'kt3' } })

console.log('\n== Quyền truy cập')
let r = await goi({ hanh_dong: 'khoa_vapid' }); kt(r.s === 401, 'chưa đăng nhập: bị từ chối (401)')
r = await goi({ hanh_dong: 'khoa_vapid' }, { token: 'tok-sai' }); kt(r.s === 401, 'token sai: bị từ chối')
r = await goi({ hanh_dong: 'khoa_vapid' }, { token: 'tok-kt3' }); kt(r.s === 403, 'tài khoản bị khóa: bị từ chối (403)')
r = await goi({ hanh_dong: 'tao', ten_dang_nhap: 'abc', mat_khau: '12345678' }, { token: 'tok-kt1' }); kt(r.s === 403 && !goiTaoUser.length, 'kế toán không tạo được tài khoản')
r = await goi({ hanh_dong: 'tao', ten_dang_nhap: 'Có Dấu', mat_khau: '12345678' }, { token: 'tok-ad' }); kt(r.s === 400, 'tên đăng nhập sai định dạng: bị từ chối')
r = await goi({ hanh_dong: 'tao', ten_dang_nhap: 'ketoan9', mat_khau: '123' }, { token: 'tok-ad' }); kt(r.s === 400, 'mật khẩu ngắn: bị từ chối')
r = await goi({ hanh_dong: 'tao', ten_dang_nhap: 'KeToan9', ho_ten: 'Kế toán 9', mat_khau: '12345678' }, { token: 'tok-ad' })
kt(r.s === 200 && goiTaoUser[0].email === 'ketoan9@qlct.example' && goiTaoUser[0].app_metadata.vai_tro === 'ketoan' && goiTaoUser[0].email_confirm === true, 'Admin tạo tài khoản: vai trò kế toán, email nội bộ, tự xác nhận')
r = await goi({ hanh_dong: 'doi_mat_khau', user_id: 'kt1', mat_khau: '12345678' }, { token: 'tok-kt1' }); kt(r.s === 403, 'kế toán không đổi được mật khẩu người khác')
r = await goi({ hanh_dong: 'doi_mat_khau', user_id: 'kt1', mat_khau: '12345678' }, { token: 'tok-ad' }); kt(r.s === 200, 'Admin đổi mật khẩu')

console.log('\n== Khóa VAPID + gửi thử')
r = await goi({ hanh_dong: 'khoa_vapid' }, { token: 'tok-kt1' }); const pub = r.j.khoa_cong_khai
kt(r.s === 200 && /^[A-Za-z0-9_-]{86,88}$/.test(pub), 'tự tạo khóa VAPID lần đầu, trả khóa công khai hợp lệ')
kt(db.cau_hinh_bi_mat.some((x) => x.khoa === 'vapid_bi_mat' && x.gia_tri.length > 30), 'khóa bí mật lưu ở CSDL (không trả về cho trình duyệt)')
r = await goi({ hanh_dong: 'khoa_vapid' }, { token: 'tok-ad' }); kt(r.j.khoa_cong_khai === pub, 'lần sau dùng lại đúng khóa cũ')
nhan.length = 0
r = await goi({ hanh_dong: 'gui_thu' }, { token: 'tok-kt1' })
kt(r.s === 200 && r.j.da_gui === 1 && r.j.thiet_bi === 1, 'gửi thử: chỉ tới thiết bị của chính người gọi')
const m = nhan[0]
kt(m && m.url === '/ok-kt1' && m.h['content-encoding'] === 'aes128gcm' && m.n > 20, 'gói tin được mã hóa aes128gcm theo chuẩn Web Push', JSON.stringify(m))
kt(m && /^vapid t=.+, k=.+$/.test(m.h.authorization) && m.h.authorization.endsWith('k=' + pub), 'gói tin ký VAPID bằng đúng khóa công khai')
kt(m && Number(m.h.ttl) > 0 && m.h.urgency === 'high', 'có TTL và độ ưu tiên cao')

console.log('\n== Cảnh báo vật tư gửi từ CSDL (pg_net)')
nhan.length = 0
r = await goi({ hanh_dong: 'day_thong_bao', id: 7 }, { ma: 'SAI' }); kt(r.s === 401 && !nhan.length, 'sai mã bí mật: từ chối, không gửi gì')
r = await goi({ hanh_dong: 'day_thong_bao', id: 7 }); kt(r.s === 401, 'không có mã bí mật: từ chối')
r = await goi({ hanh_dong: 'day_thong_bao', id: 7 }, { ma: 'MA-DUNG' })
kt(r.s === 200 && r.j.da_gui === 2, 'đúng mã: gửi cho đúng 2 người', JSON.stringify(r))
kt(nhan.map((x) => x.url).sort().join() === '/ok-ad,/ok-kt1', 'người nhận = Admin + kế toán được cấp công trình; KHÔNG gửi cho kế toán công trình khác hay tài khoản bị khóa', nhan.map((x) => x.url).join())
kt(db.thong_bao_day[0].da_gui === true && db.thong_bao_day[0].ket_qua.da_gui === 2, 'đánh dấu đã gửi + lưu kết quả')
nhan.length = 0; r = await goi({ hanh_dong: 'day_thong_bao', id: 7 }, { ma: 'MA-DUNG' }); kt(r.j.bo_qua === true && !nhan.length, 'gọi lặp: không gửi trùng thông báo')
r = await goi({ hanh_dong: 'day_thong_bao', id: 999 }, { ma: 'MA-DUNG' }); kt(r.s === 404, 'thông báo không tồn tại: 404')

console.log('\n== Thiết bị hỏng / lỗi tạm thời')
db.thiet_bi_nhan_tin = [sub('kt1', '/gone-1'), sub('kt1', '/loi-1'), sub('kt1', '/ok-2')]
r = await goi({ hanh_dong: 'gui_thu' }, { token: 'tok-kt1' })
kt(r.j.da_gui === 1 && r.j.loi === 1 && r.j.da_xoa_thiet_bi_hong === 1, 'kết quả: 1 gửi được, 1 lỗi tạm, 1 thiết bị đã gỡ', JSON.stringify(r.j))
kt(db.thiet_bi_nhan_tin.length === 2 && !db.thiet_bi_nhan_tin.some((x) => x.endpoint.includes('/gone')), 'thiết bị đã gỡ (410) bị xóa; thiết bị lỗi tạm (500) được giữ lại')

may.close(); console.log(`\n===== KẾT QUẢ: ${ok} đạt, ${bad} lỗi =====`); process.exit(bad ? 1 : 0)
