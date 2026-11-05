# Giai đoạn 2 – Trạng thái (cập nhật theo phiên làm việc)

## Đã làm và đã kiểm chứng
- CSDL + phân quyền RLS + sao lưu/phục hồi: `supabase/migrations/01_schema.sql`, `02_storage.sql`.
- Kiểm thử trên PostgreSQL 16 thật: `bash supabase/tests/run.sh` (khoảng 85 kiểm tra, tất cả đạt).
- Công thức: `cd app && npx vitest run` (4 nhóm kiểm thử đạt). `npm run build` thành công.
- Ứng dụng khởi động được trên trình duyệt giả lập điện thoại, không lỗi console.

## Đã viết mã nhưng CHƯA kiểm chứng với máy chủ thật
Toàn bộ giao diện (đăng nhập, công trình, vật tư mẫu + Excel, nhập vật tư, nhập chi phí, tổng hợp, biểu đồ,
Gantt, báo cáo năm, tài khoản, nhật ký, sao lưu), hàng đợi mất mạng, ảnh đính kèm, realtime, Edge Function.

## Chưa làm
- Thông báo đẩy khi ứng dụng đã đóng hẳn (hiện có: thông báo trong ứng dụng + thông báo hệ thống khi ứng dụng đang mở/chạy nền).
- Lịch sao lưu tự động (GitHub Actions) và giữ Supabase không bị tạm dừng.
- Tài liệu hướng dẫn triển khai/sử dụng (Giai đoạn 4).
