-- =====================================================================
-- Bổ sung 05: THÔNG TIN HỢP ĐỒNG của công trình
--   số hợp đồng, ngày ký hợp đồng, tiến độ theo hợp đồng, ngày ký biên bản bàn giao đưa vào sử dụng
--   (cột ngay_hoan_thanh_dk nay hiểu là "Ngày hoàn thành theo hợp đồng")
-- Chạy trong Supabase > SQL Editor SAU 01..04; chạy lại nhiều lần không hỏng dữ liệu.
-- =====================================================================
alter table public.cong_trinh
  add column if not exists so_hop_dong text not null default '',
  add column if not exists ngay_ky_hop_dong date,
  add column if not exists tien_do text not null default '',
  add column if not exists ngay_ky_bb_ban_giao date;

-- Bảng tổng quan: thêm các cột mới ở cuối (giữ nguyên các cột cũ)
-- chỉ tạo lại view nếu tệp 06 (bản view mới hơn) chưa được chạy
do $mig$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'v_tong_quan_cong_trinh' and column_name = 'tong_thanh_toan') then
    execute $fn$
create or replace view public.v_tong_quan_cong_trinh with (security_invoker = true) as
select c.id as cong_trinh_id, c.ten, c.chu_dau_tu, c.nam, c.trang_thai, c.luu_tru,
       c.gia_tri_hop_dong, c.ngay_khoi_cong, c.ngay_hoan_thanh_dk,
       coalesce(v.tong, 0) as vt_tong, coalesce(v.co_hd, 0) as vt_co_hd, coalesce(v.khong_hd, 0) as vt_khong_hd,
       coalesce(k.tong, 0) as cp_tong, coalesce(k.co_hd, 0) as cp_co_hd,
       coalesce(k.hdkv, 0) as cp_hdkv, coalesce(k.khong_ct, 0) as cp_khong_ct,
       c.gia_tri_hop_dong - coalesce(v.tong, 0) - coalesce(k.tong, 0) as chenh_lech,
       c.so_hop_dong, c.ngay_ky_hop_dong, c.tien_do, c.ngay_ky_bb_ban_giao
from cong_trinh c
left join (select cong_trinh_id, sum(thanh_tien) tong,
                  sum(thanh_tien) filter (where co_hoa_don) co_hd,
                  sum(thanh_tien) filter (where not co_hoa_don) khong_hd
           from phieu_nhap_vt where not da_xoa group by 1) v on v.cong_trinh_id = c.id
left join (select cong_trinh_id, sum(so_tien) tong,
                  sum(so_tien) filter (where chung_tu = 'co_hoa_don') co_hd,
                  sum(so_tien) filter (where chung_tu = 'hdkv') hdkv,
                  sum(so_tien) filter (where chung_tu = 'khong_chung_tu') khong_ct
           from chi_phi where not da_xoa group by 1) k on k.cong_trinh_id = c.id;
    $fn$;
  end if;
end $mig$;

-- Phục hồi sao lưu: nhận thêm 4 cột mới (và vẫn phục hồi được tệp sao lưu cũ chưa có các cột này)
do $mig$ begin
  if coalesce(position('thanh_toan' in pg_get_functiondef(to_regprocedure('public.phuc_hoi_sao_luu(jsonb)'))), 0) = 0 then
    execute $fn$
create or replace function public.phuc_hoi_sao_luu(data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n_ct int; n_vt int; n_pn int; n_cp int; n_pq int; n_tep int; n_dm int;
begin
  if not public.is_admin() then raise exception 'Chỉ Admin được phục hồi'; end if;
  if coalesce((data->>'phien_ban')::int, 0) <> 1 then raise exception 'Tệp sao lưu không hợp lệ'; end if;
  perform set_config('app.phuc_hoi', 'on', true);

  insert into cong_trinh (id, ten, chu_dau_tu, dia_diem, gia_tri_hop_dong, ngay_khoi_cong, ngay_hoan_thanh_dk,
                          nam, ghi_chu, trang_thai, luu_tru, so_hop_dong, ngay_ky_hop_dong, tien_do, ngay_ky_bb_ban_giao, created_by, created_at, updated_by, updated_at, version)
  select x.id, x.ten, x.chu_dau_tu, x.dia_diem, x.gia_tri_hop_dong, x.ngay_khoi_cong, x.ngay_hoan_thanh_dk,
         x.nam, x.ghi_chu, x.trang_thai, x.luu_tru, coalesce(x.so_hop_dong, ''), x.ngay_ky_hop_dong, coalesce(x.tien_do, ''), x.ngay_ky_bb_ban_giao, x.created_by, x.created_at, x.updated_by, x.updated_at, x.version
  from jsonb_populate_recordset(null::cong_trinh, data->'cong_trinh') x
  on conflict (id) do update set ten=excluded.ten, chu_dau_tu=excluded.chu_dau_tu, dia_diem=excluded.dia_diem,
    gia_tri_hop_dong=excluded.gia_tri_hop_dong, ngay_khoi_cong=excluded.ngay_khoi_cong,
    ngay_hoan_thanh_dk=excluded.ngay_hoan_thanh_dk, nam=excluded.nam, ghi_chu=excluded.ghi_chu,
    trang_thai=excluded.trang_thai, luu_tru=excluded.luu_tru, so_hop_dong=excluded.so_hop_dong, ngay_ky_hop_dong=excluded.ngay_ky_hop_dong,
    tien_do=excluded.tien_do, ngay_ky_bb_ban_giao=excluded.ngay_ky_bb_ban_giao, version=greatest(cong_trinh.version, excluded.version)+1;
  get diagnostics n_ct = row_count;

  insert into vat_tu_mau (id, cong_trinh_id, ten, dvt, khoi_luong_dt, don_gia_dt, created_by, created_at, updated_by, updated_at, version)
  select x.id, x.cong_trinh_id, x.ten, x.dvt, x.khoi_luong_dt, x.don_gia_dt, x.created_by, x.created_at, x.updated_by, x.updated_at, x.version
  from jsonb_populate_recordset(null::vat_tu_mau, data->'vat_tu_mau') x
  on conflict (id) do update set ten=excluded.ten, dvt=excluded.dvt, khoi_luong_dt=excluded.khoi_luong_dt,
    don_gia_dt=excluded.don_gia_dt, version=greatest(vat_tu_mau.version, excluded.version)+1;
  get diagnostics n_vt = row_count;

  insert into phieu_nhap_vt (id, client_id, cong_trinh_id, vat_tu_id, ngay, khoi_luong, don_gia, co_hoa_don, ghi_chu, da_xoa,
                             created_by, created_at, updated_by, updated_at, version)
  select x.id, x.client_id, x.cong_trinh_id, x.vat_tu_id, x.ngay, x.khoi_luong, x.don_gia, x.co_hoa_don, x.ghi_chu, x.da_xoa,
         x.created_by, x.created_at, x.updated_by, x.updated_at, x.version
  from jsonb_populate_recordset(null::phieu_nhap_vt, data->'phieu_nhap_vt') x
  on conflict (id) do update set vat_tu_id=excluded.vat_tu_id, ngay=excluded.ngay, khoi_luong=excluded.khoi_luong,
    don_gia=excluded.don_gia, co_hoa_don=excluded.co_hoa_don, ghi_chu=excluded.ghi_chu, da_xoa=excluded.da_xoa,
    version=greatest(phieu_nhap_vt.version, excluded.version)+1;
  get diagnostics n_pn = row_count;

  insert into chi_phi (id, client_id, cong_trinh_id, ngay, ten_chi_phi, nhom, so_tien, chung_tu, chi_cho, ghi_chu, da_xoa,
                       created_by, created_at, updated_by, updated_at, version)
  select x.id, x.client_id, x.cong_trinh_id, x.ngay, x.ten_chi_phi, x.nhom, x.so_tien, x.chung_tu, x.chi_cho, x.ghi_chu, x.da_xoa,
         x.created_by, x.created_at, x.updated_by, x.updated_at, x.version
  from jsonb_populate_recordset(null::chi_phi, data->'chi_phi') x
  on conflict (id) do update set ngay=excluded.ngay, ten_chi_phi=excluded.ten_chi_phi, nhom=excluded.nhom,
    so_tien=excluded.so_tien, chung_tu=excluded.chung_tu, chi_cho=excluded.chi_cho, ghi_chu=excluded.ghi_chu,
    da_xoa=excluded.da_xoa, version=greatest(chi_phi.version, excluded.version)+1;
  get diagnostics n_cp = row_count;

  insert into phan_quyen (user_id, cong_trinh_id)
  select x.user_id, x.cong_trinh_id from jsonb_populate_recordset(null::phan_quyen, data->'phan_quyen') x
  where exists (select 1 from profiles p where p.id = x.user_id)
  on conflict do nothing;
  get diagnostics n_pq = row_count;

  insert into tep_dinh_kem (id, cong_trinh_id, loai, ban_ghi_id, duong_dan, ten_tep, created_by, created_at)
  select x.id, x.cong_trinh_id, x.loai, x.ban_ghi_id, x.duong_dan, x.ten_tep, x.created_by, x.created_at
  from jsonb_populate_recordset(null::tep_dinh_kem, data->'tep_dinh_kem') x
  on conflict do nothing;
  get diagnostics n_tep = row_count;

  -- danh mục dùng chung (bỏ qua dòng trùng tên với dòng khác id để không vi phạm ràng buộc)
  insert into danh_muc_vat_tu (id, ten, dvt, don_gia, ghi_chu, created_by, created_at, updated_by, updated_at, version)
  select x.id, x.ten, x.dvt, x.don_gia, x.ghi_chu, x.created_by, x.created_at, x.updated_by, x.updated_at, x.version
  from jsonb_populate_recordset(null::danh_muc_vat_tu, data->'danh_muc_vat_tu') x
  where not exists (select 1 from danh_muc_vat_tu d where d.ten = x.ten and d.id <> x.id)
  on conflict (id) do update set ten=excluded.ten, dvt=excluded.dvt, don_gia=excluded.don_gia, ghi_chu=excluded.ghi_chu,
    version=greatest(danh_muc_vat_tu.version, excluded.version)+1;
  get diagnostics n_dm = row_count;

  return jsonb_build_object('cong_trinh', n_ct, 'vat_tu_mau', n_vt, 'phieu_nhap_vt', n_pn,
                            'chi_phi', n_cp, 'phan_quyen', n_pq, 'tep_dinh_kem', n_tep, 'danh_muc_vat_tu', n_dm);
end $$;
    $fn$;
  end if;
end $mig$;

