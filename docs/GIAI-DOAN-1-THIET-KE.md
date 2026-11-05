# QUẢN LÝ CÔNG TRÌNH – Giai đoạn 1: Phân tích & Thiết kế

## 1. Công nghệ đề xuất
| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Giao diện | PWA: React + Vite + TypeScript + Tailwind | Cài lên Android từ trình duyệt, chạy được trên máy tính, mã nguồn mở |
| Cơ sở dữ liệu + đăng nhập + lưu ảnh + realtime | Supabase (PostgreSQL) gói Free | Phân quyền cấp CSDL (Row Level Security), đồng bộ realtime, lưu file, có sẵn |
| Hosting | Cloudflare Pages (hoặc GitHub Pages) Free | Địa chỉ miễn phí *.pages.dev, không cần mua tên miền |
| Offline | IndexedDB + hàng đợi đồng bộ (Workbox) | Nhập khi mất mạng, tự đẩy lên khi có mạng |
| Biểu đồ | Recharts + Gantt tự vẽ | Miễn phí, mã nguồn mở |
| Excel | SheetJS (nhập/xuất) | Chạy ngay trên trình duyệt |
| Sao lưu | GitHub Actions chạy định kỳ -> xuất JSON/CSV lưu kho riêng + nút "Sao lưu" trong Admin | Miễn phí, độc lập với Supabase |

## 2. Giới hạn gói miễn phí (phải biết trước)
Supabase Free (theo trang giá chính thức, cần kiểm tra lại khi đăng ký): CSDL 500 MB, file 1 GB, 5 GB băng thông/tháng, 50.000 người dùng/tháng, 2 dự án.
- **Tự tạm dừng sau 1 tuần không có truy cập** (dữ liệu không mất, bấm khôi phục). Giải pháp: lịch GitHub Actions gọi CSDL mỗi ngày để giữ hoạt động. Nếu cả tuần không ai dùng thì vẫn cần khôi phục thủ công.
- **Không có sao lưu tự động có thể phục hồi theo ngày** trên gói Free -> bù bằng sao lưu riêng ở trên.
- **Ảnh hóa đơn 1 GB**: ứng dụng nén ảnh về ~200–300 KB trước khi tải lên => khoảng 3.500–5.000 ảnh. Hết thì phải xóa/lưu trữ ảnh cũ ra ngoài hoặc trả phí.
- Dữ liệu chữ (vật tư, chi phí) rất nhẹ; 500 MB đủ cho hàng trăm nghìn dòng.
- Cloudflare Pages Free: hosting tĩnh miễn phí, giới hạn 20.000 file/site; chưa xác minh được chính thức mức băng thông (cần kiểm tra khi đăng ký).
=> **Kết luận:** làm được với 0 đồng ở quy mô công ty nhỏ (vài chục người, vài chục công trình). Rủi ro: dung lượng ảnh và tự tạm dừng. Sẽ không nhập thẻ, không đăng ký gói trả phí.

## 3. Cơ sở dữ liệu
- `profiles` (id, họ tên, vai_trò admin|ketoan, bị_khóa)
- `cong_trinh` (id, tên, chủ_đầu_tư, địa_điểm, giá_trị_hợp_đồng, ngày_khởi_công, ngày_hoàn_thành_dk, năm, ghi_chú, trạng_thái, lưu_trữ)
- `phan_quyen` (user_id, cong_trinh_id)
- `vat_tu_mau` (id, cong_trinh_id, tên, đvt, khối_lượng_dt, đơn_giá_dt, thành_tiền_dt = KL×ĐG sinh tự động)
- `phieu_nhap_vt` (id, cong_trinh_id, ngày, vat_tu_id, đvt, khối_lượng, đơn_giá, thành_tiền = KL×ĐG sinh tự động, có_hóa_đơn bool BẮT BUỘC, ghi_chú, client_id duy nhất chống trùng, created_by/at, updated_by/at, đã_xóa)
- `chi_phi` (id, cong_trinh_id, ngày, tên_chi_phí, nhóm, số_tiền, chứng_từ ∈ {co_hoa_don, hdkv, khong_chung_tu}, chi_cho, ghi_chú, client_id, created_by/at, updated_by/at, đã_xóa)
- `tep_dinh_kem` (id, loại, bản_ghi_id, đường_dẫn_storage)
- `nhat_ky` (ai, làm gì, bảng, bản_ghi, trước/sau, thời gian) – ghi bằng trigger
- Xóa mềm (`đã_xóa`) để Admin khôi phục; số liệu tổng hợp là **VIEW SQL tính từ dữ liệu gốc**, không lưu số cộng dồn => sửa/xóa là cập nhật ngay, không tính trùng.
- Chống ghi đè: cột `version`, sửa chỉ thành công khi đúng version; trùng `client_id` bị từ chối.

## 4. Phân quyền (thực thi bằng Row Level Security, không chỉ ẩn nút)
| Hành động | Admin | Kế toán |
|---|---|---|
| Xem công trình | tất cả | chỉ được cấp |
| Thêm/sửa/xóa công trình, hợp đồng, vật tư mẫu, dự toán | ✔ | ✘ |
| Nhập vật tư/chi phí | ✔ | ✔ (công trình được cấp) |
| Sửa/xóa phiếu | tất cả | chỉ do mình tạo |
| Tạo/khóa tài khoản, đặt lại mật khẩu, sao lưu/phục hồi, nhật ký | ✔ | ✘ |
Tạo tài khoản/đặt lại mật khẩu chạy bằng hàm máy chủ (Edge Function) giữ khóa bí mật phía máy chủ; trình duyệt chỉ có khóa công khai.

## 5. Công thức (đặt trong CSDL)
Thành tiền = KL × ĐG; Còn lại = DT − TT; Vượt = max(TT − DT, 0); Tổng VT = Σ thành tiền phiếu chưa xóa; Tổng chi phí = Σ khoản chi chưa xóa. Cảnh báo: khi cộng dồn ≥ dự toán, màu vàng (đạt) / đỏ (vượt); đẩy thông báo qua Web Push.

## 6. Giao diện (tiếng Việt, ưu tiên điện thoại)
Thanh dưới: **Tổng quan | Công trình | Nhập VT | Nhập chi phí | Báo cáo**; Admin thêm **Tài khoản**. Chọn công trình ở đầu trang; trong công trình có các thẻ: Thông tin, Vật tư mẫu, Nhập vật tư, Nhập chi phí, Tổng hợp VT, Tổng hợp CP, Tài chính. Nút lớn, chữ ≥16px, màu: xanh=ổn, vàng=đạt dự toán, đỏ=vượt.

## 7. Hạn chế cần chấp nhận
- Thông báo đẩy trên iPhone chỉ hoạt động khi cài PWA lên màn hình chính (iOS 16.4+).
- Offline: nhập được, ảnh đính kèm tải lên khi có mạng; hai người sửa cùng một bản ghi thì người đến sau được hỏi lại.
- Tôi không tự đăng ký tài khoản hộ bạn: bạn cần tự tạo tài khoản Supabase, Cloudflare (hoặc GitHub) miễn phí bằng email, tôi hướng dẫn từng bước.
