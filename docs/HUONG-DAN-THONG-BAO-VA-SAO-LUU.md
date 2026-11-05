# Cài đặt THÔNG BÁO ĐẨY và SAO LƯU TỰ ĐỘNG (làm 1 lần, 0 đồng)

Điều kiện: đã làm xong các bước ở `HUONG-DAN-TRIEN-KHAI.md` (có Supabase, Cloudflare, đăng nhập được) và đã chạy `01`, `02`, `03` trong SQL Editor.

## A. Trong Supabase

### A1. Bật 2 tiện ích
**Database → Extensions** → tìm và bật (Enable): **`pg_cron`** (hẹn giờ sao lưu) và **`pg_net`** (để cơ sở dữ liệu gọi gửi thông báo).

### A2. Chạy tệp SQL số 04
SQL Editor → New query → dán toàn bộ `supabase/migrations/04_thong_bao_day_va_sao_luu_tu_dong.sql` → Run. Phải báo Success.
Nếu thấy dòng "CHƯA đặt được lịch sao lưu (pg_cron)": bạn chưa bật pg_cron ở A1; bật rồi chạy lại tệp 04 (an toàn, chạy lại được).

### A3. Khai báo địa chỉ gửi thông báo (SQL Editor → New query → Run)
Thay `<PROJECT_URL>` bằng Project URL của bạn và `<KHOA_CONG_KHAI>` bằng khóa anon/publishable (cả hai là thông tin công khai). `hyper-action` là đuôi địa chỉ hàm của bạn (xem cột URL ở Edge Functions).
```sql
insert into public.cau_hinh_bi_mat (khoa, gia_tri) values
  ('url_day_thong_bao', '<PROJECT_URL>/functions/v1/hyper-action'),
  ('khoa_anon', '<KHOA_CONG_KHAI>')
on conflict (khoa) do update set gia_tri = excluded.gia_tri;
```

### A4. Cập nhật hàm máy chủ
Edge Functions → bấm vào hàm hiện có (`quan-tri-tai-khoan`, địa chỉ `hyper-action`) → mở trình soạn thảo → **xóa hết mã cũ, dán toàn bộ** `supabase/functions/quan-tri-tai-khoan/index.ts` → **Deploy updates**.
Sau đó vào tab **Details** (hoặc Settings) của hàm và **TẮT** công tắc **"Verify JWT" / "Enforce JWT verification"** rồi lưu. Lý do: cơ sở dữ liệu gọi hàm bằng mã bí mật riêng chứ không bằng đăng nhập người dùng; hàm tự kiểm tra quyền cho từng loại yêu cầu nên vẫn an toàn.

## B. Trên mỗi điện thoại (Admin và kế toán)
1. Mở ứng dụng bằng **Chrome** (Android), đã cài ra màn hình chính càng tốt.
2. ☰ **Thêm → 🔔 Thông báo đẩy cảnh báo vật tư → Bật thông báo đẩy** → bấm **Cho phép** khi trình duyệt hỏi.
3. Bấm **Gửi thông báo thử** → thanh thông báo của máy phải hiện "Thông báo thử".
4. iPhone: phải cài ứng dụng ra màn hình chính (Chia sẻ → Thêm vào MH chính) và dùng iOS 16.4 trở lên.

Từ đó, mỗi khi một vật tư **đạt hoặc vượt khối lượng dự toán** (ai nhập cũng vậy), Admin và các kế toán được cấp quyền công trình đó nhận thông báo, kể cả khi đã đóng ứng dụng. Mỗi mức chỉ báo một lần; giảm bớt khối lượng không báo lại; khi lại đạt hoặc vượt thì báo lại.

## C. Sao lưu ra ngoài qua GitHub (chống mất cả dự án Supabase)
Bản sao lưu **tự động trong hệ thống** (mỗi đêm 03:00, giữ 30 bản) hoạt động ngay sau bước A. Phần C thêm bản **mã hóa cất ở GitHub 90 ngày** và giữ Supabase miễn phí không bị tạm dừng.

1. Trong phần mềm: **Quản lý tài khoản → Sao lưu ra ngoài qua GitHub → Hiện mã sao lưu → Chép mã**.
2. GitHub → kho `Quan-ly-cong-trinh` → **Settings → Secrets and variables → Actions → New repository secret**, tạo 4 bí mật:

| Tên | Giá trị |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | khóa anon/publishable |
| `MA_SAO_LUU` | mã vừa chép ở bước 1 |
| `MAT_KHAU_MA_HOA` | mật khẩu TỰ ĐẶT, từ 12 ký tự. **Cất kỹ ở nơi khác: mất mật khẩu này thì không giải mã được các bản sao lưu ngoài** |

3. Sau khi mã nguồn đã vào nhánh `main` (Merge PR): tab **Actions → "Sao lưu tự động và giữ Supabase hoạt động" → Run workflow** để chạy thử. Thành công thì mỗi ngày 02:30 tự chạy. Tải bản sao lưu: vào lần chạy → mục **Artifacts**.
4. Phục hồi từ bản ngoài: giải nén tệp tải về → trong phần mềm **Phục hồi từ tệp sao lưu** → chọn tệp `.ma-hoa.json` → nhập `MAT_KHAU_MA_HOA`.

Lưu ý: GitHub tự tắt lịch chạy của kho sau 60 ngày không có hoạt động nào; nếu thấy tab Actions báo lịch bị tắt, bấm **Enable**. Nhớ hằng tuần có thể bấm "Sao lưu ngay" để tải thêm một bản về máy.

## Giới hạn cần biết
- Ảnh hóa đơn nằm ở kho Storage, **không** nằm trong các bản sao lưu dữ liệu.
- Gói miễn phí giới hạn 500 MB cơ sở dữ liệu: 30 bản tự động mỗi bản bằng kích thước dữ liệu, nếu dữ liệu lớn dần hãy giảm số bản giữ (đổi số 30 trong lịch) hoặc dọn bản cũ.
- Thông báo đẩy gửi qua dịch vụ của Google/Apple/Mozilla; điện thoại tắt hoàn toàn, tiết kiệm pin quá mạnh hoặc bị chặn thông báo sẽ không nhận được ngay.
