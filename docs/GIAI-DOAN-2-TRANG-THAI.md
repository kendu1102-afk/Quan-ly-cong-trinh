# Giai đoạn 2 – Trạng thái

## Đã kiểm chứng
- CSDL + RLS + sao lưu/phục hồi: `bash supabase/tests/run.sh` (khoảng 85 kiểm tra, đạt).
- Công thức: `cd app && npx vitest run` (đạt).
- Đầu-cuối trên trình duyệt (Chromium giả lập điện thoại) với PostgreSQL + PostgREST thật:
  `tests/e2e/start-infra.sh` rồi `NODE_PATH=$(npm root -g) node tests/e2e/e2e.cjs` → 64 đạt, 0 lỗi.
  (Cần tải PostgREST v12.2.3 vào `tests/e2e/.postgrest-bin`.)

## Phần e2e chỉ MÔ PHỎNG (cần kiểm chứng trên Supabase thật)
Đăng nhập (GoTrue), kho ảnh (Storage), đồng bộ tức thời (Realtime), Edge Function tạo tài khoản, thông báo hệ thống.

## Chưa làm
- Thông báo đẩy khi ứng dụng đã đóng hẳn.
- Lịch sao lưu tự động + giữ Supabase không tạm dừng.
