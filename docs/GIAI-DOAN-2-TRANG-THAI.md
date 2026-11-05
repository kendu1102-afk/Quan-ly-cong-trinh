# Trạng thái kiểm thử

| Bộ kiểm thử | Cách chạy | Kết quả gần nhất |
|---|---|---|
| CSDL + phân quyền + thông báo đẩy + sao lưu (PostgreSQL 16 thật) | `bash supabase/tests/run.sh` | 200 kiểm tra đạt |
| Hàm máy chủ (mã thật, thư viện web-push thật, máy chủ đẩy HTTPS giả) | `cd tests/edge && npm i && node edge.test.mjs` | 25 đạt |
| Công thức + mã hóa sao lưu | `cd app && npx vitest run` | 13 đạt |
| Trình duyệt đầu-cuối (PostgreSQL + PostgREST thật) | `tests/e2e/start-infra.sh` rồi `NODE_PATH=$(npm root -g) node tests/e2e/e2e.cjs` | 159 đạt |
| Service worker nhận push (Chromium thật) | `NODE_PATH=$(npm root -g) node tests/e2e/sw-push.cjs` | 8 đạt |

(e2e cần tải PostgREST v12.2.3 vào `tests/e2e/.postgrest-bin`.)

## CHƯA kiểm chứng trên hệ thống thật (chỉ mô phỏng hoặc kiểm bằng Node)
- Đăng nhập thật, kho ảnh thật, đồng bộ tức thời (Realtime).
- Edge Function chạy trong môi trường Deno của Supabase (đã kiểm bằng Node với mã giống hệt).
- pg_cron và pg_net trên Supabase (kiểm bằng mô phỏng pg_net).
- Gửi push thật qua dịch vụ của Google/Apple tới điện thoại thật.
- Lịch GitHub Actions chạy thật (kiểm bằng cách chạy đúng tập lệnh `scripts/sao-luu.mjs` trong máy).
