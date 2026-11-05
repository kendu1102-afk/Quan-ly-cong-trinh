# Hướng dẫn đưa phần mềm lên Internet (làm 1 lần, khoảng 30 phút, 0 đồng)

Bạn cần: tài khoản Supabase và Cloudflare (hoặc GitHub) đã tạo bằng email. KHÔNG nhập thẻ ngân hàng ở bất kỳ bước nào.

## Bước 1. Tạo dự án Supabase
1. Vào supabase.com → **New project**. Đặt tên `quan-ly-cong-trinh`, chọn vùng **Southeast Asia (Singapore)**, đặt Database Password (ghi lại, cất kỹ, không gửi cho ai kể cả tôi). Chọn gói **Free**.
2. Chờ 1–2 phút cho dự án khởi tạo.

## Bước 2. Tắt tự đăng ký (quan trọng cho an toàn)
Authentication → **Sign In / Providers** → tắt **Allow new users to sign up** → Save.
Tắt luôn **Confirm email** (tài khoản do Admin tạo, không gửi email).

## Bước 3. Tạo cơ sở dữ liệu
SQL Editor → New query → dán TOÀN BỘ nội dung `supabase/migrations/01_schema.sql` → Run (phải báo Success).
Tiếp tục New query → dán `supabase/migrations/02_storage.sql` → Run.
Tiếp tục lần lượt với `03_danh_muc_vat_tu.sql`, `04_thong_bao_day_va_sao_luu_tu_dong.sql` (xem thêm `HUONG-DAN-THONG-BAO-VA-SAO-LUU.md`) và `05_thong_tin_hop_dong.sql` (số hợp đồng, ngày ký hợp đồng, tiến độ, ngày ký biên bản bàn giao). Sau cùng chạy `06_khoi_luong_hop_dong_thanh_toan.sql` (khối lượng hợp đồng theo hạng mục, khối lượng hoàn thành, các lần thanh toán). Mỗi tệp chạy lại nhiều lần không hỏng dữ liệu.

## Bước 4. Tạo tài khoản Admin đầu tiên
Authentication → Users → **Add user → Create new user**: nhập email của bạn + mật khẩu mạnh, tick **Auto Confirm User**.
Người đầu tiên được tạo tự động thành **Admin**. (Đăng nhập bằng email này.)

## Bước 5. Cài hàm tạo tài khoản kế toán
Edge Functions → **Deploy a new function → Via Editor** → tên `quan-tri-tai-khoan` → dán nội dung `supabase/functions/quan-tri-tai-khoan/index.ts` → Deploy.
LƯU Ý: nếu sau khi Deploy, cột URL của hàm hiện đuôi khác (ví dụ `.../functions/v1/hyper-action`), hãy đặt thêm biến `VITE_HAM_QUAN_TRI` = đuôi đó (ví dụ `hyper-action`) ở Bước 7.
(Hàm tự dùng khóa bí mật của Supabase ở phía máy chủ; bạn không phải dán khóa nào.)

## Bước 6. Lấy 2 giá trị công khai
Project Settings → **API**: copy **Project URL** và khóa **anon public**. (TUYỆT ĐỐI không dùng/không gửi khóa `service_role`.)

## Bước 7. Đưa ứng dụng lên Cloudflare Pages
1. Cloudflare → Workers & Pages → Create → **Pages → Connect to Git** → chọn kho `Quan-ly-cong-trinh`, nhánh `claude/optimistic-ramanujan-p6n8xs` (hoặc nhánh chính sau khi gộp).
2. Cấu hình: **Root directory** `app` · **Build command** `npm run build` · **Output directory** `dist`.
3. Environment variables: `VITE_SUPABASE_URL` = Project URL, `VITE_SUPABASE_ANON_KEY` = khóa anon public.
4. Deploy. Bạn sẽ có địa chỉ dạng `https://ten-ban-dat.pages.dev`.

## Bước 8. Cài lên điện thoại
Android: mở địa chỉ bằng Chrome → menu ⋮ → **Cài đặt ứng dụng / Thêm vào màn hình chính**.
Đăng nhập → vào **Thêm → Bật thông báo cảnh báo**.

## Bước 9. Gửi tôi để kiểm thử trên hệ thống thật
Chỉ cần gửi: **Project URL** và khóa **anon public** (cả hai là công khai, không bí mật), cùng địa chỉ `.pages.dev`.
Để tôi thử đăng nhập, bạn tạo 2 tài khoản THỬ riêng (ví dụ `thu_admin`, `thu_ketoan`) với mật khẩu tạm; sau khi thử xong sẽ xóa/đổi mật khẩu. Không gửi mật khẩu của tài khoản thật.
