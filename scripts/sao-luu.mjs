// Chạy bởi GitHub Actions mỗi ngày: lấy bản sao lưu từ Supabase bằng mã bí mật, mã hóa, ghi ra thư mục sao-luu/.
// Việc gọi API này cũng giữ cho dự án Supabase miễn phí không bị tạm dừng vì không hoạt động.
import fs from 'node:fs'
import { maHoa } from './ma-hoa.mjs'

const { SUPABASE_URL, SUPABASE_ANON_KEY, MA_SAO_LUU, MAT_KHAU_MA_HOA } = process.env
for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_ANON_KEY, MA_SAO_LUU, MAT_KHAU_MA_HOA })) {
  if (!v) { console.error(`Thiếu bí mật ${k}. Xem docs/HUONG-DAN-TRIEN-KHAI.md (mục sao lưu tự động).`); process.exit(1) }
}
if (MAT_KHAU_MA_HOA.length < 12) { console.error('MAT_KHAU_MA_HOA phải từ 12 ký tự trở lên'); process.exit(1) }

const r = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/lay_sao_luu_ngoai`, {
  method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ ma: MA_SAO_LUU }),
})
const txt = await r.text()
if (!r.ok) { console.error('Lấy sao lưu thất bại:', r.status, txt.slice(0, 200)); process.exit(1) }
const d = JSON.parse(txt)
if (d.phien_ban !== 1 || !Array.isArray(d.cong_trinh)) { console.error('Dữ liệu sao lưu không hợp lệ'); process.exit(1) }

const ngay = new Date().toISOString().slice(0, 10)
fs.mkdirSync('sao-luu', { recursive: true })
fs.writeFileSync(`sao-luu/sao-luu-${ngay}.ma-hoa.json`, JSON.stringify(maHoa(txt, MAT_KHAU_MA_HOA)))
console.log(`Đã sao lưu ${d.cong_trinh.length} công trình, ${d.phieu_nhap_vt.length} phiếu vật tư, ${d.chi_phi.length} khoản chi (đã mã hóa).`)
