create schema t;
create function t.as_user(u uuid) returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claim.sub', u::text, false);
      perform set_config('request.jwt.claim.role','authenticated', false); set role authenticated; end $$;
create function t.as_super() returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claim.sub','', false); perform set_config('request.jwt.claim.role','', false); end $$;
create function t.fails(q text, label text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then raise notice 'OK   %  (bị chặn: %)', label, left(sqlerrm,60); return; end;
  raise exception 'LỖI: % — lẽ ra phải bị chặn', label;
end $$;
create function t.eq(a anyelement, b anyelement, label text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'LỖI: % — nhận % mong đợi %', label, a, b; end if;
      raise notice 'OK   %  (= %)', label, a; end $$;
create function t.cnt(q text) returns bigint language plpgsql as $$
declare n bigint; begin execute q; get diagnostics n = row_count; return n; end $$;
grant usage on schema t to authenticated; grant execute on all functions in schema t to authenticated;

-- 1. Tài khoản: người đầu tiên = Admin
insert into auth.users (id,email) values ('00000000-0000-0000-0000-0000000000a1','admin@x');
insert into auth.users (id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000b1','kt1@x','{"ho_ten":"Kế toán 1"}'),
 ('00000000-0000-0000-0000-0000000000b2','kt2@x','{"ho_ten":"Kế toán 2"}');
select t.eq((select vai_tro from profiles where email='admin@x'),'admin','người đầu tiên là admin');
select t.eq((select vai_tro from profiles where email='kt1@x'),'ketoan','người sau là kế toán');
insert into auth.users (id,email,raw_app_meta_data) values ('00000000-0000-0000-0000-0000000000a2','admin2@x','{"vai_tro":"admin"}');

-- 2. Admin tạo 2 công trình, vật tư mẫu, phân quyền
select t.as_user('00000000-0000-0000-0000-0000000000a1');
insert into cong_trinh (id,ten,gia_tri_hop_dong,nam,ngay_khoi_cong,ngay_hoan_thanh_dk) values
 ('11111111-0000-0000-0000-000000000001','Cầu A',1000000000,2026,'2026-01-01','2026-12-31'),
 ('11111111-0000-0000-0000-000000000002','Đường B',500000000,2026,'2026-03-01','2026-09-30');
insert into vat_tu_mau (id,cong_trinh_id,ten,dvt,khoi_luong_dt,don_gia_dt) values
 ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','Xi măng','tấn',100,1500000),
 ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000002','Cát vàng','m3',50,300000);
insert into phan_quyen values ('00000000-0000-0000-0000-0000000000b1','11111111-0000-0000-0000-000000000001'),
                              ('00000000-0000-0000-0000-0000000000b2','11111111-0000-0000-0000-000000000002');
select t.eq((select thanh_tien_dt from vat_tu_mau where ten='Xi măng'), 150000000::numeric, 'thành tiền dự toán = KL×ĐG');

-- 3. Kế toán 1: quyền hạn
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select t.eq((select count(*) from cong_trinh),1::bigint,'KT1 chỉ thấy công trình được cấp');
select t.eq(t.cnt($q$update cong_trinh set gia_tri_hop_dong=1$q$),0::bigint,'KT sửa giá trị hợp đồng (0 dòng được sửa)');
select t.eq((select gia_tri_hop_dong from cong_trinh where id='11111111-0000-0000-0000-000000000001'),1000000000::numeric,'giá trị hợp đồng không đổi');
select t.fails($q$insert into cong_trinh(ten) values ('Lén')$q$,'KT tạo công trình');
select t.fails($q$insert into vat_tu_mau(cong_trinh_id,ten,dvt) values ('11111111-0000-0000-0000-000000000001','X','y')$q$,'KT thêm vật tư mẫu');
select t.eq(t.cnt('update vat_tu_mau set khoi_luong_dt=999'),0::bigint,'KT sửa khối lượng dự toán (0 dòng được sửa)');
select t.eq(t.cnt('delete from vat_tu_mau'),0::bigint,'KT xóa vật tư mẫu (0 dòng)');
select t.eq(t.cnt($q$update profiles set vai_tro='admin' where email='kt1@x'$q$),0::bigint,'KT tự nâng quyền (0 dòng được sửa)');
select t.eq(t.cnt('update phan_quyen set cong_trinh_id=cong_trinh_id'),0::bigint,'KT sửa phân quyền (0 dòng)');
select t.eq((select count(*) from nhat_ky),0::bigint,'KT không đọc được nhật ký');

-- 4. Nhập vật tư: Xi măng dự toán 100 tấn
insert into phieu_nhap_vt (client_id,cong_trinh_id,vat_tu_id,ngay,khoi_luong,don_gia,co_hoa_don) values
 ('aaaaaaaa-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','2026-02-01',40,1500000,true),
 ('aaaaaaaa-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','2026-02-02',60,1400000,false);
select t.eq((select thanh_tien from phieu_nhap_vt where client_id='aaaaaaaa-0000-0000-0000-000000000002'),84000000::numeric,'thành tiền = KL×ĐG');
select t.eq((select created_by from phieu_nhap_vt where client_id='aaaaaaaa-0000-0000-0000-000000000001'),'00000000-0000-0000-0000-0000000000b1'::uuid,'tự ghi người nhập');
select t.eq((select canh_bao from v_tong_hop_vat_tu where ten='Xi măng'),'dat','nhập đủ 100/100 -> cảnh báo ĐẠT');
select t.eq((select kl_con_lai from v_tong_hop_vat_tu where ten='Xi măng'),0::numeric,'còn lại = 0');
select t.fails($q$insert into phieu_nhap_vt (client_id,cong_trinh_id,vat_tu_id,ngay,khoi_luong,don_gia,co_hoa_don)
  values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','2026-02-01',1,1,true)$q$,'nhập trùng client_id');
select t.fails($q$insert into phieu_nhap_vt (client_id,cong_trinh_id,vat_tu_id,ngay,khoi_luong,don_gia,co_hoa_don)
  values (gen_random_uuid(),'11111111-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000002','2026-02-01',1,1,true)$q$,'KT1 nhập vào công trình không được cấp');
select t.fails($q$insert into phieu_nhap_vt (client_id,cong_trinh_id,vat_tu_id,ngay,khoi_luong,don_gia,co_hoa_don)
  values (gen_random_uuid(),'11111111-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002','2026-02-01',1,1,true)$q$,'vật tư thuộc công trình khác');
select t.fails($q$insert into phieu_nhap_vt (client_id,cong_trinh_id,vat_tu_id,ngay,khoi_luong,don_gia,co_hoa_don)
  values (gen_random_uuid(),'11111111-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','2026-02-01',1,1,null)$q$,'thiếu tình trạng hóa đơn');
select t.fails($q$insert into phieu_nhap_vt (client_id,cong_trinh_id,vat_tu_id,ngay,khoi_luong,don_gia,co_hoa_don)
  values (gen_random_uuid(),'11111111-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','2026-02-01',-5,1,true)$q$,'khối lượng âm');
insert into phieu_nhap_vt (client_id,cong_trinh_id,vat_tu_id,ngay,khoi_luong,don_gia,co_hoa_don) values
 ('aaaaaaaa-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','2026-02-03',10,1500000,true);
select t.eq((select kl_vuot from v_tong_hop_vat_tu where ten='Xi măng'),10::numeric,'nhập thêm 10 -> vượt 10');
select t.eq((select canh_bao from v_canh_bao_vat_tu where ten='Xi măng'),'vuot','có trong danh sách cảnh báo (vượt)');
-- sửa: giảm phiếu 3 xuống 4 -> không vượt
select t.eq(t.cnt($q$update phieu_nhap_vt set khoi_luong=4 where client_id='aaaaaaaa-0000-0000-0000-000000000003'$q$),1::bigint,'KT sửa phiếu của mình');
select t.eq((select kl_vuot from v_tong_hop_vat_tu where ten='Xi măng'),4::numeric,'sửa -> vượt cập nhật còn 4');
-- chống ghi đè: đọc version rồi sửa với version cũ
select t.eq((select version from phieu_nhap_vt where client_id='aaaaaaaa-0000-0000-0000-000000000003'),2,'version tăng sau khi sửa');
select t.eq(t.cnt($q$update phieu_nhap_vt set khoi_luong=7 where client_id='aaaaaaaa-0000-0000-0000-000000000003' and version=1$q$),0::bigint,'sửa với version cũ bị từ chối (chống ghi đè)');
-- xóa mềm -> tổng hợp tự giảm
select t.eq(t.cnt($q$update phieu_nhap_vt set da_xoa=true where client_id='aaaaaaaa-0000-0000-0000-000000000003'$q$),1::bigint,'KT xóa phiếu của mình');
select t.eq((select kl_thuc_te from v_tong_hop_vat_tu where ten='Xi măng'),100::numeric,'xóa -> thực tế còn 100');
select t.eq((select canh_bao from v_tong_hop_vat_tu where ten='Xi măng'),'dat','xóa -> cảnh báo về ĐẠT');
select t.eq(t.cnt('delete from phieu_nhap_vt'),0::bigint,'KT xóa vĩnh viễn (0 dòng)');
select t.eq((select gia_tri_co_hd from v_tong_hop_vat_tu where ten='Xi măng'),60000000::numeric,'giá trị có hóa đơn');
select t.eq((select gia_tri_khong_hd from v_tong_hop_vat_tu where ten='Xi măng'),84000000::numeric,'giá trị không hóa đơn');
select t.eq((select kl_co_hd from v_tong_hop_vat_tu where ten='Xi măng'),40::numeric,'KL có hóa đơn');
select t.eq((select kl_khong_hd from v_tong_hop_vat_tu where ten='Xi măng'),60::numeric,'KL không hóa đơn');

-- 5. Chi phí đủ 3 loại chứng từ
insert into chi_phi (client_id,cong_trinh_id,ngay,ten_chi_phi,nhom,so_tien,chung_tu,chi_cho) values
 ('bbbbbbbb-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','2026-02-05','Thuê máy','Máy',10000000,'co_hoa_don','Ông X'),
 ('bbbbbbbb-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001','2026-02-06','Nhân công','Nhân công',5000000,'hdkv','Ông Y'),
 ('bbbbbbbb-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000001','2026-03-07','Chi khác','',2000000,'khong_chung_tu','Ông X');
select t.fails($q$insert into chi_phi (client_id,cong_trinh_id,ngay,ten_chi_phi,so_tien,chung_tu) values (gen_random_uuid(),'11111111-0000-0000-0000-000000000001','2026-01-01','a',1,'khac')$q$,'loại chứng từ không hợp lệ');
select t.eq((select tong from v_chi_phi_theo_thang where thang='2026-02'),15000000::numeric,'chi phí tháng 2');
select t.eq((select tong from v_chi_phi_theo_thang where thang='2026-03'),2000000::numeric,'chi phí tháng 3');
select t.eq((select tong from v_chi_phi_theo_nguoi_nhan where chi_cho='Ông X'),12000000::numeric,'chi theo người nhận');
select t.eq((select tong from v_chi_phi_theo_nhom where nhom='(Chưa phân nhóm)'),2000000::numeric,'nhóm để trống');

-- 6. Tổng quan
select t.eq((select cp_tong from v_tong_quan_cong_trinh where ten='Cầu A'),17000000::numeric,'tổng chi phí');
select t.eq((select cp_hdkv from v_tong_quan_cong_trinh where ten='Cầu A'),5000000::numeric,'chi phí HĐKV');
select t.eq((select vt_tong from v_tong_quan_cong_trinh where ten='Cầu A'),144000000::numeric,'tổng vật tư');
select t.eq((select chenh_lech from v_tong_quan_cong_trinh where ten='Cầu A'),(1000000000-144000000-17000000)::numeric,'chênh lệch = HĐ − VT − CP');

-- 7. Kế toán 2 không đụng được dữ liệu KT1 và công trình khác
select t.as_user('00000000-0000-0000-0000-0000000000b2');
select t.eq((select count(*) from phieu_nhap_vt),0::bigint,'KT2 không thấy phiếu công trình khác');
select t.eq((select count(*) from chi_phi),0::bigint,'KT2 không thấy chi phí công trình khác');
select t.eq(t.cnt('update chi_phi set so_tien=1'),0::bigint,'KT2 không sửa được chi phí công trình khác');
-- cấp thêm quyền để thử "người khác nhập"
select t.as_user('00000000-0000-0000-0000-0000000000a1');
insert into phan_quyen values ('00000000-0000-0000-0000-0000000000b2','11111111-0000-0000-0000-000000000001');
select t.as_user('00000000-0000-0000-0000-0000000000b2');
select t.eq((select count(*) from chi_phi),3::bigint,'KT2 thấy chi phí sau khi được cấp quyền');
select t.eq(t.cnt('update chi_phi set so_tien=1'),0::bigint,'KT2 không sửa được bản ghi của KT1');
select t.eq(t.cnt('update chi_phi set da_xoa=true'),0::bigint,'KT2 không xóa được bản ghi của KT1');
select t.eq(t.cnt('update phieu_nhap_vt set khoi_luong=1'),0::bigint,'KT2 không sửa được phiếu của KT1');

-- 8. Nhật ký + Admin
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select t.eq((select count(*) > 10 from nhat_ky),true,'Admin đọc được nhật ký');
select t.eq((select count(*) from nhat_ky where hanh_dong='XOA' and bang='phieu_nhap_vt' and user_id='00000000-0000-0000-0000-0000000000b1'),1::bigint,'nhật ký ghi đúng người xóa');
select t.eq((select count(*) from phieu_nhap_vt where da_xoa),1::bigint,'Admin thấy cả phiếu đã xóa');
select t.eq(t.cnt($q$update phieu_nhap_vt set da_xoa=false where client_id='aaaaaaaa-0000-0000-0000-000000000003'$q$),1::bigint,'Admin khôi phục phiếu đã xóa');
select t.eq(t.cnt($q$update phieu_nhap_vt set da_xoa=true where client_id='aaaaaaaa-0000-0000-0000-000000000003'$q$),1::bigint,'Admin xóa lại');
select t.eq(t.cnt($q$update cong_trinh set gia_tri_hop_dong=1200000000 where ten='Cầu A'$q$),1::bigint,'Admin sửa giá trị hợp đồng');
select t.eq((select chenh_lech from v_tong_quan_cong_trinh where ten='Cầu A'),(1200000000-144000000-17000000)::numeric,'báo cáo tự cập nhật theo hợp đồng mới');
select t.eq(t.cnt($q$update profiles set bi_khoa=true where email='kt2@x'$q$),1::bigint,'Admin khóa tài khoản');
select t.as_user('00000000-0000-0000-0000-0000000000b2');
select t.eq((select count(*) from cong_trinh),0::bigint,'tài khoản bị khóa không xem được gì');
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select t.eq(t.cnt($q$update profiles set bi_khoa=false where email='kt2@x'$q$),1::bigint,'Admin mở khóa');

-- 9. Admin cuối cùng
select t.eq(t.cnt($q$update profiles set vai_tro='ketoan' where email='admin2@x'$q$),1::bigint,'hạ admin2 khi còn admin1');
select t.fails($q$update profiles set vai_tro='ketoan' where email='admin@x'$q$,'hạ Admin cuối cùng');

-- 9b. Danh mục vật tư mẫu dùng chung
select t.as_user('00000000-0000-0000-0000-0000000000a1');
insert into danh_muc_vat_tu (ten,dvt,don_gia) values ('Xi măng PC40','tấn',1500000),('Thép phi 10','kg',18000);
select t.eq((select count(*) from danh_muc_vat_tu),2::bigint,'Admin thêm 2 vật tư vào danh mục chung');
select t.fails($q$insert into danh_muc_vat_tu (ten,dvt) values ('Xi măng PC40','tấn')$q$,'trùng tên trong danh mục');
select t.fails($q$insert into danh_muc_vat_tu (ten,dvt,don_gia) values ('Âm','kg',-1)$q$,'đơn giá âm');
select t.eq(t.cnt($q$update danh_muc_vat_tu set don_gia=19000 where ten='Thép phi 10'$q$),1::bigint,'Admin sửa đơn giá tham khảo');
select t.eq((select version from danh_muc_vat_tu where ten='Thép phi 10'),2,'danh mục có số phiên bản');
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select t.eq((select count(*) from danh_muc_vat_tu),2::bigint,'Kế toán xem được danh mục chung');
select t.fails($q$insert into danh_muc_vat_tu (ten,dvt) values ('Lén','kg')$q$,'Kế toán thêm vào danh mục');
select t.eq(t.cnt('update danh_muc_vat_tu set don_gia=1'),0::bigint,'Kế toán sửa danh mục (0 dòng)');
select t.eq(t.cnt('delete from danh_muc_vat_tu'),0::bigint,'Kế toán xóa danh mục (0 dòng)');
select t.as_super();
select t.eq(has_table_privilege('anon','public.danh_muc_vat_tu','select'),false,'người chưa đăng nhập không đọc được danh mục');
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select t.eq((select count(*) from nhat_ky where bang='danh_muc_vat_tu'),3::bigint,'nhật ký ghi thao tác trên danh mục');

-- 10. Sao lưu / phục hồi
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select t.fails('select xuat_sao_luu()','KT sao lưu');
select t.fails($q$select phuc_hoi_sao_luu('{"phien_ban":1}')$q$,'KT phục hồi');
select t.as_user('00000000-0000-0000-0000-0000000000a1');
create temp table bk as select xuat_sao_luu() as j;
grant all on bk to authenticated;
select t.eq(jsonb_array_length((select j->'phieu_nhap_vt' from bk)),3,'sao lưu có 3 phiếu');
select t.as_super();
-- mô phỏng sự cố: mất dữ liệu
delete from chi_phi; delete from phieu_nhap_vt; delete from danh_muc_vat_tu;
select t.eq((select count(*) from phieu_nhap_vt),0::bigint,'sự cố: mất phiếu');
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select phuc_hoi_sao_luu((select j from bk));
select t.eq((select count(*) from phieu_nhap_vt),3::bigint,'phục hồi 3 phiếu');
select t.eq((select count(*) from chi_phi),3::bigint,'phục hồi 3 khoản chi');
select t.eq((select count(*) from danh_muc_vat_tu),2::bigint,'phục hồi danh mục vật tư chung');
select t.eq((select kl_thuc_te from v_tong_hop_vat_tu where ten='Xi măng'),100::numeric,'số tổng hợp đúng sau phục hồi');
select t.eq((select created_by from phieu_nhap_vt where client_id='aaaaaaaa-0000-0000-0000-000000000001'),'00000000-0000-0000-0000-0000000000b1'::uuid,'giữ nguyên người nhập gốc');
select phuc_hoi_sao_luu((select j from bk));
select t.eq((select count(*) from phieu_nhap_vt),3::bigint,'phục hồi lần 2 không nhân đôi dữ liệu');
select t.as_super();
select t.eq(has_function_privilege('anon','public.xuat_sao_luu()','execute'),false,'người chưa đăng nhập không gọi được sao lưu');
select t.eq(has_table_privilege('anon','public.chi_phi','select'),false,'người chưa đăng nhập không đọc được bảng');
\echo ===== TẤT CẢ KIỂM THỬ ĐẠT =====
